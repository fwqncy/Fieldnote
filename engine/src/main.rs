//! Fieldnote relay: an always-on replica that devices sync with whenever they
//! have signal. It stores every op in SQLite and hands each device the ops it
//! has not seen yet. It never resolves conflicts, because there are none.

use axum::{extract::State, http::StatusCode, routing::{get, post}, Json, Router};
use fieldnote::sync::{Note, Op, SCHEMA};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, net::SocketAddr, path::PathBuf, sync::{Arc, Mutex}};
use tower_http::{cors::CorsLayer, services::{ServeDir, ServeFile}};

const PAGE: i64 = 20_000;

struct Relay {
    db: Connection,
    notes: HashMap<u64, Note>,
}

type Shared = Arc<Mutex<Relay>>;

#[derive(Deserialize)]
struct SyncRequest {
    #[serde(with = "fieldnote::sync::op::hex64")]
    replica: u64,
    cursor: i64,
    ops: Vec<Op>,
}

#[derive(Serialize)]
struct SyncResponse {
    cursor: i64,
    more: bool,
    ops: Vec<Op>,
    /// Incoming ops the relay had not seen before.
    accepted: usize,
    conflicts: usize,
}

#[derive(Serialize)]
struct NoteSummary {
    id: String,
    title: String,
    body: String,
    ops: usize,
    clock: fieldnote::sync::Clock,
}

#[tokio::main]
async fn main() {
    let db_path = std::env::var("FIELDNOTE_DB").unwrap_or_else(|_| "fieldnote.db".into());
    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(7878);

    let db = Connection::open(&db_path).expect("open database");
    db.execute_batch(&format!("PRAGMA journal_mode = WAL; {SCHEMA};")).expect("create schema");
    let notes = load(&db).expect("load ops");
    println!("fieldnote relay · {} notes from {db_path}", notes.len());

    let state: Shared = Arc::new(Mutex::new(Relay { db, notes }));

    let dist = PathBuf::from(std::env::var("FIELDNOTE_APP").unwrap_or_else(|_| "../app/dist".into()));
    let app = Router::new()
        .route("/api/health", get(|| async { Json(serde_json::json!({ "ok": true })) }))
        .route("/api/sync", post(sync))
        .route("/api/notes", get(notes_index))
        .fallback_service(ServeDir::new(&dist).fallback(ServeFile::new(dist.join("index.html"))))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("listening on http://localhost:{port}");
    let listener = tokio::net::TcpListener::bind(addr).await.expect("bind port");
    axum::serve(listener, app)
        .with_graceful_shutdown(async { tokio::signal::ctrl_c().await.ok(); })
        .await
        .expect("serve");
}

fn load(db: &Connection) -> rusqlite::Result<HashMap<u64, Note>> {
    let mut grouped: HashMap<u64, Vec<Op>> = HashMap::new();
    let mut stmt = db.prepare("SELECT bytes FROM ops ORDER BY rowid")?;
    for bytes in stmt.query_map([], |r| r.get::<_, Vec<u8>>(0))? {
        if let Ok(op) = Op::from_bytes(&bytes?) {
            grouped.entry(op.id.note).or_default().push(op);
        }
    }
    Ok(grouped.into_iter().map(|(id, ops)| (id, Note::from_ops(id, ops))).collect())
}

async fn sync(State(state): State<Shared>, Json(req): Json<SyncRequest>) -> Result<Json<SyncResponse>, (StatusCode, String)> {
    let mut guard = state.lock().map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "relay poisoned".into()))?;
    let relay = &mut *guard;
    let fail = |e: rusqlite::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string());

    let mut by_note: HashMap<u64, Vec<Op>> = HashMap::new();
    for op in req.ops {
        by_note.entry(op.id.note).or_default().push(op);
    }

    let mut accepted = 0;
    for (id, ops) in by_note {
        // The incoming batch is a note of its own; its synced_at is 0, so
        // persisting it writes every op and INSERT OR IGNORE drops repeats.
        let remote = Note::from_ops(id, ops);
        remote.persist(&relay.db).map_err(fail)?;
        let local = relay.notes.entry(id).or_insert_with(|| Note::new(id));
        let before = local.ops.len();
        local.merge(&remote);
        accepted += local.ops.len() - before;
    }

    let mut stmt = relay
        .db
        .prepare("SELECT rowid, bytes FROM ops WHERE rowid > ?1 ORDER BY rowid LIMIT ?2")
        .map_err(fail)?;
    let rows: Vec<(i64, Vec<u8>)> = stmt
        .query_map([req.cursor, PAGE], |r| Ok((r.get(0)?, r.get(1)?)))
        .map_err(fail)?
        .collect::<rusqlite::Result<_>>()
        .map_err(fail)?;

    let cursor = rows.last().map(|(rowid, _)| *rowid).unwrap_or(req.cursor);
    let more = rows.len() as i64 == PAGE;
    let ops = rows
        .iter()
        .filter_map(|(_, bytes)| Op::from_bytes(bytes).ok())
        .filter(|op| op.id.replica != req.replica)
        .collect();

    Ok(Json(SyncResponse { cursor, more, ops, accepted, conflicts: 0 }))
}

async fn notes_index(State(state): State<Shared>) -> Json<Vec<NoteSummary>> {
    let relay = state.lock().expect("relay poisoned");
    let mut out: Vec<NoteSummary> = relay
        .notes
        .values()
        .map(|n| NoteSummary {
            id: format!("{:016x}", n.id),
            title: n.title().to_string(),
            body: n.body.clone(),
            ops: n.ops.len(),
            clock: n.clock.clone(),
        })
        .collect();
    out.sort_by(|a, b| a.title.cmp(&b.title));
    Json(out)
}
