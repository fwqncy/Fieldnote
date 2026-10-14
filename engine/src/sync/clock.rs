use serde::{Serialize, Serializer};
use std::collections::BTreeMap;

use super::op::OpId;

/// Version vector: the highest Lamport time seen from each replica.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Clock(pub BTreeMap<u64, u64>);

impl Clock {
    /// Pointwise maximum. Commutative, associative and idempotent, so the
    /// order devices reconnect in never matters.
    pub fn join(&mut self, other: &Clock) {
        for (replica, &t) in &other.0 {
            let mine = self.0.entry(*replica).or_insert(0);
            *mine = (*mine).max(t);
        }
    }

    pub fn observe(&mut self, id: &OpId) {
        let t = self.0.entry(id.replica).or_insert(0);
        *t = (*t).max(id.lamport);
    }

    /// Highest Lamport time seen from any replica.
    pub fn max(&self) -> u64 {
        self.0.values().copied().max().unwrap_or(0)
    }

    /// Next Lamport time for `replica`: strictly after everything seen.
    pub fn tick(&mut self, replica: u64) -> u64 {
        let next = self.max() + 1;
        self.0.insert(replica, next);
        next
    }
}

impl Serialize for Clock {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.collect_map(self.0.iter().map(|(r, t)| (format!("{r:016x}"), t)))
    }
}
