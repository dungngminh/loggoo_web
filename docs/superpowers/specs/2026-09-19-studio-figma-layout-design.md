# Studio: Figma-style layout

## Goal

Rearrange `/studio` into Figma's three-column layout (top toolbar, Layers on the left, canvas in the middle, a selection-driven Design panel on the right) and add Figma-style numeric fields for X / Y / rotation / corner radius. Brand colours stay (`--lg-*` tokens). No schema, draft, or export changes.

## Layout

Grid: 48px top bar, then `240px | minmax(0,1fr) | 260px`. Below 900px the three columns stack (left, canvas, right).

- **Top bar**: Loggoo mark, `name · en` inline input, derived id. Centre: tool group — `select`, `draw slot`, `add note text`, `add mood face`, `add loggoo icon` (add tools hide once the item exists, as today). Right: `grid` / `safe area` toggles, zoom readout, `start over`, `export zip` (primary).
- **Left panel**: Pages (`story 9:16` / `post 4:5`, the aspect switch), Layers list (unchanged behaviour: pinned note text on top, background at the bottom, ▲ ▼ reorder, click selects), and a collapsible `Pack` `<details>` with `name · vi`, `loggoo plus`, `schema · app version` + hint, and the rail icon picker + status.
- **Right panel (Design)**: sections shown by `data-selection` on the studio root:
  - `none` / `frame` / `background`: **Aspect** — overlay upload / remove, background colour / image / remove, statuses.
  - `slot`: **Position** X Y dp · **Size** W H dp + lock ratio · **Rotation** ° · **Corner** dp · **Photo** index · delete slot.
  - `sticker`: X Y dp · size dp · rotation ° · logo style toggle (logo only) · delete.
  - `text`: X Y dp · width dp · rotation ° · font · size sp · colour · max lines · align · delete.
  - Always: **Export** — status line and the catalog snippet textarea.
- A one-line status under the canvas keeps the mode hint and aspect label.

## Implementation

- `src/pages/studio.astro`: rewrite the shell markup and CSS. Every existing `data-*` selector and every canvas class (`.frame`, `.slot`, `.mood-face`, `.text-box`, helpers) is kept so `frame-studio.ts` keeps working. Schema gating via `data-min-schema` / `data-max-schema` stays.
- `src/scripts/frame-studio.ts`:
  - `renderInspector` also fills X / Y / rotation / corner for slots, X / Y / size / rotation for the selected sticker, X / Y / width / rotation for text; sets `root.dataset.selection`.
  - `change` handlers for the new inputs, clamped like the canvas drags (slot inside the canvas, rotation −180..180 for slots and stickers, −45..45 for text, corner ≥ 0, sticker size within the canvas), then `commit()` + re-render + save.
  - Sticker and text inspectors get their own containers (`data-sticker-inspector`, `data-text-inspector`).
- `frame-pack.ts`, draft, export: untouched.

## Testing

`npx tsc --noEmit`, `npm run build`, manual pass in the browser: select each kind, type into the new fields, check the Design panel switches, undo works, mobile stack.

## Out of scope

Drag-to-reorder layers, rulers, multi-select, Prototype tab, dark theme.
