# Fieldnote

**Offline-first sync engine.** CRDT-based note sync for field researchers working without signal for days at a time, with conflict-free merges on reconnect.

> Designed so notes edited offline on more than one device merge cleanly on reconnect, without losing changes.

`Rust` · `SQLite` · `React Native`

## Run It

Requires Node 16+ and Rust (via [rustup](https://rustup.rs)).

```sh
npm run setup     # install the app's packages
npm run dev       # Rust relay on :7878 + app on http://localhost:5173
```

Other scripts:

| Command | What it does |
| --- | --- |
| `npm start` | Production build, then the relay serves the app and sync on http://localhost:7878 |
| `npm test` | Rust engine tests: convergence, idempotence, persistence, last-writer-wins |
| `npm run typecheck` | TypeScript check of the app |

The app works without the relay. Notes live in SQLite on the device, and the status bar shows "Working offline" until a relay is reachable.

### Try a Two-Device Merge

1. Open `http://localhost:5173` and `http://localhost:5173/?device=tablet`. Each `?device=` slot has its own SQLite database and replica id.
2. In one, press the mountain icon (**Expedition mode**) to go offline on purpose.
3. Edit the same note in both.
4. Turn Expedition mode off. You'll see *“Back online after … · N edits merged, 0 conflicts”*, and both devices show identical text.

## How Sync Works

```
engine/src/sync/
  merge.rs   Note::merge & Note::persist (the code from the design, verbatim)
  op.rs      OpId, Op (Ins / Del / Set), RGA render, hex wire format
  clock.rs   version vector: join, observe, tick
  note.rs    Note: local insert / delete / set
engine/src/main.rs   relay: POST /api/sync, GET /api/notes, serves app/dist
app/src/crdt/note.ts the same CRDT in TypeScript, op-for-op compatible
app/src/store/db.ts  on-device SQLite (sql.js / WASM), same `ops` schema
```

- Every character is an **insert op** anchored after another op (an RGA sequence CRDT). Deletes are tombstones. Titles and flags are last-writer-wins registers.
- Ops have globally unique ids `(lamport, replica, note)`, so **merging is a set union**. It is commutative, associative and idempotent, which means devices can reconnect in any order and conflicts can't happen.
- Local edits go into an **outbox** in SQLite. The sync client pushes the outbox and pulls ops past its cursor whenever it can reach the relay.
- The relay persists with `INSERT OR IGNORE INTO ops`, exactly as in `merge.rs`, and renders notes in Rust. `GET /api/notes` returns the same text the devices show.

## Features

**From Obsidian & Logseq**
- Markdown with live **Edit / Read / Split** views (`⌘E` toggles)
- `[[Wikilinks]]` with autocomplete; links to missing notes create them; renaming a note updates links everywhere
- `![[Embeds]]`, `#tags`, `==highlights==`, `> [!callouts]`, tables, code blocks
- **Backlinks** with context, **unlinked mentions** (one-click link), **outline**
- **Constellation**: 3D graph view (Three.js) with tag & unwritten-link stars, filtering, fly-to-note
- **Journal** of daily notes, **Tasks** collected from every note, **full-text search** with `#tag` and `is:` filters
- **Command palette** (`⌘K`), **quick switcher** (`⌘O`), templates, pinning, trash with undo, Markdown import/export

**Only in Fieldnote**
- **Expedition mode**: go offline deliberately; queued ops are counted in the status bar
- **Chronos**: scrub a note through every version it has had, and restore any of them as a new edit
- **Palimpsest**: every character ever written, tinted by device, with deleted text struck through but still legible
- **Provenance**: which devices wrote how much of each note
- **The Oracle**: resurfaces a note you've left alone, with a question to take back into the field
- **Stamp location**: GPS coordinates, accuracy & altitude in one keystroke (GPS works without signal)
- **Field Days**: activity heatmap and a laurel-leaf writing streak
- **Field templates**: transect, water sample, point count, camp inventory, field day

## Appearance

- **Apollo** (default): sun gold, black & lapis blue
- **Tyrian**: burgundy & navy
- **Your Colours**: pick accent and ground on a colour wheel, by hex, or with the eyedropper. Text colours are adjusted automatically so they stay readable.
- **Light or dark** dropdown (or match the system), motion setting (respects `prefers-reduced-motion`), falling-leaves toggle

The home scene is Three.js: Apollo's sun crown, a fluted Ionic column in procedural marble, and laurel leaves drifting through gold dust. GSAP handles the choreography. Scenes pause when off-screen and stay still when motion is reduced.

## About React Native

The UI is written with React Native primitives (`View`, `Text`, `Pressable`, `TextInput`, `StyleSheet`, `AppRegistry`) and runs on the web through `react-native-web`. Three.js, GSAP and the colour wheel live in platform files (`*.web.tsx`), the usual React Native pattern. Shipping to iOS or Android would mean adding Expo with native versions of those files (e.g. `expo-gl`, `expo-sqlite`). The sync engine and data model would stay the same.
