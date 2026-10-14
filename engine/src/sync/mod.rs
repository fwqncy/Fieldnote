//! Offline-first sync: op-based CRDT notes that merge without conflicts.

pub mod clock;
pub mod merge;
pub mod note;
pub mod op;

pub use clock::Clock;
pub use merge::SCHEMA;
pub use note::Note;
pub use op::{Kind, Op, OpId, OpsExt};
