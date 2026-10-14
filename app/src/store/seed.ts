// First-run notes. Ids, replica and timestamps are fixed, so two devices that
// both seed produce identical ops and the relay dedups them on sync.

import { Note, type Op } from '../crdt/note';

export const SEED_REPLICA = '5eed000000000001';
export const SYSTEM_NOTE = '0000000000000001';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 4, 3, 7, 30); // 05 · 2026

type Seed = { id: string; title: string; steps: string[]; day: number; journal?: string; pinned?: boolean };

const seeds: Seed[] = [
  {
    id: '00000000000000a1',
    title: 'Welcome to Fieldnote',
    day: 0,
    pinned: true,
    steps: [
      `Fieldnote is an offline-first notebook for field researchers working without signal for days at a time. Every edit is stored as an operation in SQLite on this device, and merges conflict-free on reconnect.

> [!tip] Start here
> Press ⌘K (Ctrl K) for the command palette. Everything in the app is reachable from it.

## The Basics
- Link notes with double brackets: [[Ridge camp]], [[Transect B, plot 4]]
- Tag anything with a hash: #guide
- Embed a note inline with an exclamation mark: ![[Camp inventory]]
- Tasks are checkboxes, collected on the **Tasks** page
`,
      `Fieldnote is an offline-first notebook for field researchers working without signal for days at a time. Every edit is stored as an operation in SQLite on this device, and merges conflict-free on reconnect.

> [!tip] Start here
> Press ⌘K (Ctrl K) for the command palette. Everything in the app is reachable from it.

## The Basics
- Link notes with double brackets: [[Ridge camp]], [[Transect B, plot 4]]
- Tag anything with a hash: #guide
- Embed a note inline with an exclamation mark: ![[Camp inventory]]
- Tasks are checkboxes, collected on the **Tasks** page
- ==Highlight== text, \`code\`, *italics*, ~~strike~~

## Made for the Field
- **Expedition mode** cuts the network on purpose. Keep writing; edits queue in the outbox.
- **Chronos** scrubs a note back through every version it has ever had.
- **Palimpsest** shows every character ever written, tinted by device, with deleted text still legible underneath.
- **The Oracle** resurfaces a note you have not touched in a while.
- **Stamp location** drops GPS coordinates into the note.
- **Constellation** is the graph of everything, drawn as a night sky.

## Try Sync
Run the relay (\`cargo run\` in /engine), then open a second "device" at \`?device=tablet\`. Turn on Expedition mode in one, edit the same note in both, and reconnect.

- [ ] Open the [[Constellation]] graph
- [ ] Write today's journal entry
- [x] Install Fieldnote
`,
    ],
  },
  {
    id: '00000000000000b1',
    title: 'Transect B, plot 4',
    day: 2,
    steps: [
      `Lichen cover up ~20% since the 2025 survey. #transect #lichen

## Plot
- Quadrats 1–6 photographed
- Method per [[Lichen survey method]]
`,
      `Lichen cover up ~20% since the 2025 survey, mostly *Cladonia* on the north-facing rocks. #transect #lichen

## Plot
- Quadrats 1–6 photographed
- Quadrat 4 disturbed: reindeer tracks across the upper edge
- Method per [[Lichen survey method]]
- Walked out from [[Ridge camp]], 40 min

## To Do
- [ ] Re-shoot quadrat 2 in flat light
- [x] Log GPS for the plot corners
- [ ] Cross-check species against [[Species list]]
`,
    ],
  },
  {
    id: '00000000000000b2',
    title: 'Water sample log',
    day: 3,
    steps: [
      `pH 6.8, turbidity low, 2 vials. #water

| Site | pH | Turbidity | Vials |
| --- | --- | --- | --- |
| Inlet | 6.8 | Low | 2 |
`,
      `pH 6.8, turbidity low, 2 vials. #water

| Site | pH | Turbidity | Vials |
| --- | --- | --- | --- |
| Inlet | 6.8 | Low | 2 |
| Outflow | 7.1 | Low | 2 |
| Tarn | 6.4 | Medium | 1 |

> [!warning] Cold chain
> Vials stay in the snow cache until the helicopter on day 9.

- [ ] Label the tarn vial with time & temperature
- [ ] Recalibrate the pH meter, see [[Equipment checklist]]
`,
    ],
  },
  {
    id: '00000000000000b3',
    title: 'Bird count, ridge',
    day: 4,
    steps: [
      `3× ptarmigan, 1× raven. #birds

Point count from the cairn above [[Ridge camp]], 10 minutes, wind light from the west.
`,
      `3× ptarmigan, 1× raven. #birds

Point count from the cairn above [[Ridge camp]], 10 minutes, wind light from the west.

- Ptarmigan: two calling, one flushed from the scree
- Raven: overhead, heading for the valley
- Possible snow bunting, *not* confirmed

See also [[Species list]].
`,
    ],
  },
  {
    id: '00000000000000b4',
    title: 'Camp inventory',
    day: 5,
    pinned: true,
    steps: [
      `Fuel for 4 more days. #camp

- [ ] Ration the white gas
- [x] Count the dehydrated meals: 22
`,
      `Fuel for 4 more days. #camp

- [ ] Ration the white gas
- [x] Count the dehydrated meals: 22
- [ ] Dry the spare socks
- [ ] Check the satellite messenger battery

Resupply plan lives in [[Ridge camp]].
`,
    ],
  },
  {
    id: '00000000000000c1',
    title: 'Ridge camp',
    day: 1,
    steps: [
      `Base for the transect work. 📍 68.3561° N, 18.8166° E · 1,140 m

## Notes from Here
- [[Transect B, plot 4]]
- [[Bird count, ridge]]
- [[Water sample log]]
- [[Camp inventory]]

No signal anywhere on the ridge. Satellite messenger only. #camp
`,
    ],
  },
  {
    id: '00000000000000c2',
    title: 'Lichen survey method',
    day: 0,
    steps: [
      `1. Place a 50 × 50 cm quadrat at each marked corner
2. Photograph straight down from 1.2 m
3. Estimate percent cover per growth form
4. Record substrate & aspect

> [!note] Consistency
> Same observer for all plots where possible. Note the light.

Used on [[Transect B, plot 4]]. #lichen #method
`,
    ],
  },
  {
    id: '00000000000000c3',
    title: 'Species list',
    day: 1,
    steps: [
      `## Birds
- Rock ptarmigan, *Lagopus muta*
- Common raven, *Corvus corax*
- Snow bunting, *Plectrophenax nivalis* (unconfirmed)

## Lichens
- *Cladonia rangiferina*
- *Cetraria islandica*

Counts in [[Bird count, ridge]]. #birds #lichen
`,
    ],
  },
  {
    id: '00000000000000c4',
    title: 'Equipment checklist',
    day: 0,
    steps: [
      `- [x] pH meter & buffer solutions
- [x] Sample vials (12)
- [x] Quadrat frame
- [ ] Spare batteries, AA × 8
- [x] Satellite messenger
- [ ] Waterproof notebook (backup for when Fieldnote is out of battery)

Used for [[Water sample log]] & [[Camp inventory]]. #method
`,
    ],
  },
  {
    id: '00000000000000c5',
    title: 'Constellation',
    day: 6,
    steps: [
      `The graph view draws every note as a star and every link as a line between them. Notes with more links shine brighter.

The ancient Greeks named their constellations after the stories they knew. Name yours after your field seasons. #guide
`,
    ],
  },
  {
    id: '00000000000000d1',
    title: '2026-05-04',
    journal: '2026-05-04',
    day: 1,
    steps: [
      `Walked in from the road head. Light rain, then clear. Set up [[Ridge camp]].

- [x] Pitch tents
- [x] Cache the vials in snow
`,
    ],
  },
  {
    id: '00000000000000d2',
    title: '2026-05-06',
    journal: '2026-05-06',
    day: 3,
    steps: [
      `Long day on [[Transect B, plot 4]]. Lichen visibly thicker than the 2025 photos. Water samples at the inlet in the afternoon, see [[Water sample log]].
`,
    ],
  },
  {
    id: '00000000000000d3',
    title: '2026-05-08',
    journal: '2026-05-08',
    day: 5,
    steps: [
      `Fog until noon. Did the [[Bird count, ridge]] once it lifted. Fuel getting low, see [[Camp inventory]].

> Three days without signal. Everything still merges when we get back down.
`,
    ],
  },
];

export function seedOps(): Op[] {
  const ops: Op[] = [];
  for (const s of seeds) {
    const note = new Note(s.id);
    const t = T0 + s.day * DAY;
    ops.push(note.set(SEED_REPLICA, 'title', s.title, t));
    ops.push(note.set(SEED_REPLICA, 'created', String(t), t));
    if (s.journal) ops.push(note.set(SEED_REPLICA, 'journal', s.journal, t));
    if (s.pinned) ops.push(note.set(SEED_REPLICA, 'pinned', '1', t));
    s.steps.forEach((body, i) => ops.push(...note.edit(SEED_REPLICA, body, t + i * 3 * 3_600_000)));
  }
  return ops;
}
