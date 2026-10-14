export type Template = { id: string; name: string; description: string; title: (date: string) => string; body: (date: string) => string };

export const TEMPLATES: Template[] = [
  {
    id: 'transect',
    name: 'Transect Survey',
    description: 'Plot, quadrats, cover estimates & follow-ups',
    title: (d) => `Transect, ${d}`,
    body: () => `Cover estimate: ~% since last survey. #transect

## Plot
- Quadrats photographed:
- Disturbance:
- Method per [[Lichen survey method]]

## To Do
- [ ] Log GPS for plot corners
- [ ] Cross-check against [[Species list]]
`,
  },
  {
    id: 'water',
    name: 'Water Sample',
    description: 'pH, turbidity & vial table',
    title: (d) => `Water samples, ${d}`,
    body: () => `pH , turbidity , vials. #water

| Site | pH | Turbidity | Vials |
| --- | --- | --- | --- |
|  |  |  |  |

- [ ] Label vials with time & temperature
`,
  },
  {
    id: 'birds',
    name: 'Point Count',
    description: 'Ten-minute bird count with conditions',
    title: (d) => `Bird count, ${d}`,
    body: () => `#birds

Point count from , 10 minutes. Wind: . Cloud: .

-
See also [[Species list]].
`,
  },
  {
    id: 'inventory',
    name: 'Camp Inventory',
    description: 'Fuel, food & kit with checkboxes',
    title: (d) => `Inventory, ${d}`,
    body: () => `Fuel for  more days. #camp

- [ ] Fuel:
- [ ] Meals:
- [ ] Batteries:
- [ ] Water treatment:
`,
  },
  {
    id: 'daily',
    name: 'Field Day',
    description: 'Weather, plan, observations & reflection',
    title: (d) => d,
    body: () => `**Weather:**
**Plan:**

## Observations
-

## Reflection
>
`,
  },
];
