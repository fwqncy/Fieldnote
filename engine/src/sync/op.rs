//! Operations: the only thing that ever travels between devices.
//!
//! A note's text is a replicated growable array (RGA): every character is an
//! `Ins` op anchored after another op, and deletions are tombstones. Titles and
//! flags are last-writer-wins registers (`Set`). Because ops are immutable and
//! uniquely identified, merging is a set union and can never conflict.

use rusqlite::types::{ToSql, ToSqlOutput};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Globally unique op identity. Ordered by Lamport time, then replica, which
/// gives every replica the same total order for concurrent inserts.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct OpId {
    pub lamport: u64,
    #[serde(with = "hex64")]
    pub replica: u64,
    #[serde(with = "hex64")]
    pub note: u64,
}

impl OpId {
    /// Storage key shared with the app's SQLite schema: `note.lamport.replica`.
    pub fn key(&self) -> String {
        format!("{:016x}.{:016x}.{:016x}", self.note, self.lamport, self.replica)
    }
}

impl ToSql for OpId {
    fn to_sql(&self) -> rusqlite::Result<ToSqlOutput<'_>> {
        Ok(ToSqlOutput::from(self.key()))
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "t", rename_all = "lowercase")]
pub enum Kind {
    /// Insert one character after `after` (`None` = start of the note).
    Ins { after: Option<OpId>, ch: char },
    /// Tombstone the insert `target`.
    Del { target: OpId },
    /// Last-writer-wins register, e.g. `title`, `pinned`, `trashed`.
    Set { key: String, value: String },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Op {
    pub id: OpId,
    /// Wall-clock milliseconds on the authoring device. Display only, never
    /// used for ordering.
    pub ts: u64,
    #[serde(flatten)]
    pub kind: Kind,
}

impl Op {
    pub fn to_bytes(&self) -> Vec<u8> {
        serde_json::to_vec(self).expect("ops always serialize")
    }

    pub fn from_bytes(bytes: &[u8]) -> serde_json::Result<Op> {
        serde_json::from_slice(bytes)
    }
}

/// Queries over a note's op log.
pub trait OpsExt {
    /// Ops authored after Lamport time `lamport`.
    fn since(&self, lamport: u64) -> impl Iterator<Item = &Op>;
    /// Visible insert ids in document order.
    fn visible(&self) -> Vec<OpId>;
    /// The note body as plain text.
    fn render(&self) -> String;
    /// Current value of a last-writer-wins register.
    fn register(&self, key: &str) -> Option<&str>;
}

impl OpsExt for BTreeMap<OpId, Op> {
    fn since(&self, lamport: u64) -> impl Iterator<Item = &Op> {
        self.values().filter(move |op| op.id.lamport > lamport)
    }

    fn visible(&self) -> Vec<OpId> {
        let mut children: BTreeMap<Option<OpId>, Vec<OpId>> = BTreeMap::new();
        let mut deleted = std::collections::HashSet::new();
        for op in self.values() {
            match &op.kind {
                Kind::Ins { after, .. } => children.entry(*after).or_default().push(op.id),
                Kind::Del { target } => {
                    deleted.insert(*target);
                }
                Kind::Set { .. } => {}
            }
        }
        // Pre-order walk; siblings newest-first. Iterative so long notes, which
        // form deep chains, cannot overflow the stack. BTreeMap iteration is
        // ascending, so pushing in that order pops the newest sibling first.
        let mut out = Vec::new();
        let mut stack: Vec<OpId> = children.get(&None).cloned().unwrap_or_default();
        while let Some(id) = stack.pop() {
            if !deleted.contains(&id) {
                out.push(id);
            }
            if let Some(kids) = children.get(&Some(id)) {
                stack.extend(kids.iter().copied());
            }
        }
        out
    }

    fn render(&self) -> String {
        self.visible()
            .iter()
            .filter_map(|id| match self.get(id).map(|op| &op.kind) {
                Some(Kind::Ins { ch, .. }) => Some(*ch),
                _ => None,
            })
            .collect()
    }

    fn register(&self, key: &str) -> Option<&str> {
        self.values().rev().find_map(|op| match &op.kind {
            Kind::Set { key: k, value } if k == key => Some(value.as_str()),
            _ => None,
        })
    }
}

/// u64 ids travel as 16-digit hex strings so JavaScript never rounds them.
pub mod hex64 {
    use serde::{de::Error, Deserialize, Deserializer, Serializer};

    pub fn serialize<S: Serializer>(v: &u64, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&format!("{v:016x}"))
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<u64, D::Error> {
        let s = String::deserialize(d)?;
        u64::from_str_radix(&s, 16).map_err(D::Error::custom)
    }
}
