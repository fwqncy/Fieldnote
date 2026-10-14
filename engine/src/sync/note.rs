use std::collections::BTreeMap;

use super::clock::Clock;
use super::op::{Kind, Op, OpId, OpsExt};

#[derive(Clone, Debug, Default)]
pub struct Note {
    pub id: u64,
    pub ops: BTreeMap<OpId, Op>,
    pub clock: Clock,
    /// Rendered text, kept in sync with `ops` by every mutation.
    pub body: String,
    /// Lamport time up to which ops are known to be persisted.
    pub synced_at: u64,
}

impl Note {
    pub fn new(id: u64) -> Self {
        Note { id, ..Default::default() }
    }

    pub fn from_ops(id: u64, ops: impl IntoIterator<Item = Op>) -> Self {
        let mut note = Note::new(id);
        for op in ops {
            note.clock.observe(&op.id);
            note.ops.insert(op.id, op);
        }
        note.body = note.ops.render();
        note
    }

    pub fn title(&self) -> &str {
        self.ops.register("title").unwrap_or("Untitled")
    }

    /// Insert `text` at visible character `index`, authored by `replica`.
    pub fn insert(&mut self, replica: u64, index: usize, text: &str, ts: u64) -> Vec<Op> {
        let visible = self.ops.visible();
        let mut after = index.checked_sub(1).and_then(|i| visible.get(i).copied());
        let mut made = Vec::new();
        for ch in text.chars() {
            let op = self.author(replica, ts, Kind::Ins { after, ch });
            after = Some(op.id);
            made.push(op);
        }
        self.body = self.ops.render();
        made
    }

    /// Delete `len` visible characters starting at `index`.
    pub fn delete(&mut self, replica: u64, index: usize, len: usize, ts: u64) -> Vec<Op> {
        let targets: Vec<OpId> = self.ops.visible().into_iter().skip(index).take(len).collect();
        let made = targets
            .into_iter()
            .map(|target| self.author(replica, ts, Kind::Del { target }))
            .collect();
        self.body = self.ops.render();
        made
    }

    pub fn set(&mut self, replica: u64, key: &str, value: &str, ts: u64) -> Op {
        self.author(replica, ts, Kind::Set { key: key.into(), value: value.into() })
    }

    fn author(&mut self, replica: u64, ts: u64, kind: Kind) -> Op {
        let lamport = self.clock.tick(replica);
        let op = Op { id: OpId { lamport, replica, note: self.id }, ts, kind };
        self.ops.insert(op.id, op.clone());
        op
    }
}
