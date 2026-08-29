# Frame studio (authoring)

## Summary

- **What it does:** An unlisted page at `/studio` where a pack author uploads story/post overlays (png, jpg, or jpeg), places photo slots and one optional mood face on a live canvas, and exports a zip to commit into `loggoo_asset`.
- **Primary user journey:** Open `/studio` → enter localized names (id is derived from English) → pick story or post → upload the overlay → draw and adjust photo slots → optionally add, move, resize, or rotate one mood face for that aspect → repeat for the other aspect → export zip → unzip into `loggoo_asset/frames/<id>/` and paste the catalog snippet into `catalog.json`.
- **Key states:** empty canvas; overlay loaded; photo slot selected; optional mood face absent/present/selected; export validation (error toast + invalid field ring); catalog snippet filled after a successful export (success toast).
- **Status:** in progress on `loggoo_web`. The app fetch/renderer is a separate change in `loggoo_app`.

## Implementation

- **Architecture & data flow:** Static Astro page, client-only editor. Photo geometry uses canvas fractions. Schema v2 stores an optional mood placement per aspect as normalized `x`/`y`, fixed-design-canvas `sizeDp`, and rotation. Export builds `manifest.json` plus the selected images into an uncompressed zip. GitHub Pages on `loggoo_asset` is the host the app fetches; this page never talks to GitHub.
- **Key files:**
  - `src/pages/studio.astro` — unlisted studio shell, not linked from `Nav`.
  - `src/scripts/frame-studio.ts` — pointer canvas: draw, drag, resize, aspect switch.
  - `src/scripts/frame-pack.ts` — schema v2, sanitization, catalog snippet, zip STORE writer.
- **Notable decisions & trade-offs:** Editor handles paint on top of the overlay so placements stay easy to grab. The app paints photos under the overlay, then text and mood above it. Each aspect has at most one mood placement and previews a representative Loggoo-drawn face; the actual face comes from `FrameDay.topMood`. No GitHub token lives in the browser — publish remains a human git commit. Text binds are in the schema but are not authorable yet.
- **Tests:** `npm run build` / `npx astro check`. No browser E2E in v1.
- **Follow-ups:** draggable text binds; Figma plugin that dumps slot JSON; load an existing pack back onto the canvas.

## Changelog

- 2026-08-29: Schema v2 adds one optional, independently positioned mood face per Story/Post aspect; it moves, resizes, and rotates directly on the canvas.
- 2026-08-29: Story and post overlays stay separate; switching aspect no longer keeps the other overlay on the canvas.
- 2026-08-29: Stopped the canvas jumping: the studio is viewport-locked, the frame sizes to its stage, and dragging no longer rebuilds slot DOM.
- 2026-08-29: Rotation and corner radius are on the selected slot (top knob / inner dot), not sidebar sliders.
- 2026-08-29: Pack `id` is derived from the English name (snake_case, max 40); the studio no longer has an id field to fill.
- 2026-08-29: Export validation raises a snackbar-style toast (error/success) and rings the invalid field; inline status is only a quiet hint.
- 2026-08-29: Overlays and rail icons accept png, jpg, and jpeg; export keeps the chosen extension (`.jpeg` stored as `.jpg`).
- 2026-08-29: Added `/studio` with a drag canvas for photo slots and zip export aimed at `loggoo_asset`.
