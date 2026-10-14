// sync/merge.rs: conflict-free on reconnect
impl Note {
    pub fn merge(&mut self, remote: &Note) {
        for (id, op) in &remote.ops {
            self.ops.entry(*id).or_insert(op.clone());
        }
        self.clock.join(&remote.clock);
        self.body = self.ops.render();
    }

    pub fn persist(&self, db: &Connection) -> Result<()> {
        let tx = db.unchecked_transaction()?;
        for op in self.ops.since(self.synced_at) {
            tx.execute(
                "INSERT OR IGNORE INTO ops VALUES (?1, ?2)",
                params![op.id, op.to_bytes()],
            )?;
        }
        tx.commit()
    }
}

use rusqlite::{params, Connection, Result};

use super::note::Note;
use super::op::OpsExt;

pub const SCHEMA: &str = "CREATE TABLE IF NOT EXISTS ops (id TEXT PRIMARY KEY, bytes BLOB NOT NULL)";

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sync::op::Op;

    const A: u64 = 0xa;
    const B: u64 = 0xb;
    const C: u64 = 0xc;

    fn note_with(text: &str) -> Note {
        let mut n = Note::new(1);
        n.insert(A, 0, text, 0);
        n
    }

    #[test]
    fn concurrent_offline_edits_converge() {
        let base = note_with("Lichen cover");
        let (mut phone, mut tablet) = (base.clone(), base.clone());

        phone.insert(A, 12, " up ~20%", 1);
        tablet.insert(B, 0, "Transect B: ", 1);
        tablet.delete(B, 12, 1, 2); // drop the capital L…
        tablet.insert(B, 12, "l", 2); // …and lowercase it

        let mut a = phone.clone();
        a.merge(&tablet);
        let mut b = tablet.clone();
        b.merge(&phone);

        assert_eq!(a.body, b.body);
        assert_eq!(a.body, "Transect B: lichen cover up ~20%");
        assert_eq!(a.clock, b.clock);
    }

    #[test]
    fn merge_is_idempotent_and_order_free() {
        let base = note_with("pH 6.8");
        let (mut x, mut y, mut z) = (base.clone(), base.clone(), base.clone());
        x.insert(A, 6, ", turbidity low", 1);
        y.insert(B, 6, ", 2 vials", 1);
        z.delete(C, 0, 3, 1);

        let mut one = x.clone();
        one.merge(&y);
        one.merge(&z);
        one.merge(&y);
        let mut two = z.clone();
        two.merge(&x);
        two.merge(&y);

        assert_eq!(one.body, two.body);
        assert_eq!(one.ops.len(), two.ops.len());
    }

    #[test]
    fn three_days_offline_forty_one_edits_zero_conflicts() {
        let base = note_with("Camp inventory\n");
        let (mut field, mut camp) = (base.clone(), base.clone());
        // 41 edits made with no signal, while camp keeps editing too.
        for i in 0..41 {
            let at = field.body.chars().count();
            field.insert(A, at, &format!("- day {} fuel check\n", i / 14 + 1), i);
        }
        camp.insert(B, 15, "Fuel for 4 more days\n", 0);

        let before = camp.ops.len();
        camp.merge(&field);
        let merged = camp.ops.len() - before;
        field.merge(&camp);

        assert_eq!(field.body, camp.body);
        assert!(merged > 41, "every char of every edit arrives as its own op");
        assert!(camp.body.contains("Fuel for 4 more days"));
        assert_eq!(camp.body.matches("fuel check").count(), 41);
    }

    #[test]
    fn persist_round_trips_and_ignores_duplicates() {
        let db = Connection::open_in_memory().unwrap();
        db.execute(SCHEMA, []).unwrap();

        let mut n = note_with("Bird count, ridge");
        n.set(A, "title", "Bird count, ridge", 1);
        n.persist(&db).unwrap();
        n.persist(&db).unwrap();

        let mut stmt = db.prepare("SELECT bytes FROM ops").unwrap();
        let ops: Vec<Op> = stmt
            .query_map([], |r| r.get::<_, Vec<u8>>(0))
            .unwrap()
            .map(|b| Op::from_bytes(&b.unwrap()).unwrap())
            .collect();
        assert_eq!(ops.len(), n.ops.len());

        let back = Note::from_ops(1, ops);
        assert_eq!(back.body, n.body);
        assert_eq!(back.title(), "Bird count, ridge");
    }

    #[test]
    fn last_writer_wins_on_titles() {
        let mut a = Note::new(1);
        a.set(A, "title", "Water sample log", 0);
        let mut b = a.clone();
        a.set(A, "title", "Water samples", 1);
        b.set(B, "title", "Water sample log (lake)", 1);
        let mut x = a.clone();
        x.merge(&b);
        let mut y = b.clone();
        y.merge(&a);
        assert_eq!(x.title(), y.title());
    }
}
