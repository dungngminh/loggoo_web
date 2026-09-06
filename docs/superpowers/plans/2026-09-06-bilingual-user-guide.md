# Bilingual iOS User Guide Implementation Plan

1. Add a typed bilingual content module covering every shipped iOS user journey and its current Plus or platform limitations.
2. Build `/guide` as a static Astro page with semantic sections, a table of contents, language controls, accessible fallback behavior, and responsive guide-specific styling.
3. Add Guide links to the shared navigation and footer without changing the existing landing-page anchors.
4. Convert the supplied iPhone Home Widget recording to a trimmed, scaled, palette-optimized GIF and embed it in the widget instructions.
5. Verify locale parity, anchors, media metadata, and the Astro production build; then review the complete diff.
6. Commit the implementation and push the resulting commits directly to `origin/main`.
