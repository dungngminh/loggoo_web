# Page Animations

## Summary

Motion layer for the loggoo marketing site: sections fade and rise into place as
the visitor scrolls, and a few hero elements keep a slow idle motion so the page
does not feel static.

Primary journey: a visitor lands on `/`, the hero copy and phone shot rise in
staggered order, and every following section (mood strip, feature cards, screens,
streaks, testimonials, FAQ, about, CTA) reveals once when it enters the viewport.
Legal pages (`/privacy`, `/terms`) get the same reveal on their content blocks.

States:

- **No JavaScript** — nothing is hidden; the page renders fully static.
- **`prefers-reduced-motion: reduce`** — the `lg-motion` class is never added, so
  no element is hidden and the existing global reduced-motion rule kills the idle
  animations and hover transitions.
- **Revealed** — each element animates once, then the observer stops watching it.

Status: shipped.

## Implementation

Architecture: pure CSS transitions driven by one `IntersectionObserver`. No
dependency was added (the project has only `astro`).

Data flow:

1. `src/layouts/Base.astro` frontmatter defines `reveal` — the single list of
   selectors to animate.
2. A `<style is:global set:html>` block in `<head>` uses that list to set the
   hidden state (`opacity: 0; transform: translateY(20px)`) scoped under
   `html.lg-motion`, plus the `.is-in` transition to the visible state.
3. A blocking inline script in `<head>` adds `lg-motion` to `<html>` unless the
   visitor prefers reduced motion. Because it runs before paint, elements are
   never visible-then-hidden (no flash).
4. An inline script at the end of `<body>` receives the same `reveal` list via
   `define:vars`, observes every match, and on intersection sets a per-element
   `--lg-delay` (70 ms × position in the batch) before adding `.is-in`, then
   unobserves it.

Feature-card illustrations (`src/components/Features.astro`, scoped styles) draw
themselves off the same signal: when Base adds `.is-in` to a card, its mini
illustration animates — timeline rail line grows and photo/note slide in, mood
faces and template thumbs pop in staggered, the month grid pops then the streak
chain grows left to right, trend bars grow from the baseline, and the privacy
lock pops with its text lines widening. Mood tiles and template thumbs also lift
on hover. All of these use `animation-fill-mode: backwards` (not `both`) so the
final keyframe is not held after the animation ends, which would otherwise block
the `:hover` transforms.

Idle and hover motion lives in `src/styles/global.css`: `lg-glow` (hero glow
pulse), `lg-float` (hero mood/streak chips), `lg-flicker` (flame icons),
`lg-fade-up` (FAQ answer on open), card hover lift, mood tile and screenshot
hover lift.

Key files:

- `src/layouts/Base.astro` — reveal selector list, pre-paint hidden-state CSS,
  motion-preference gate, `IntersectionObserver`.
- `src/styles/global.css` — keyframes, idle animations, hover transitions.
- `src/components/Features.astro` — per-card mini illustration animations keyed
  off `.card.is-in`.

Decisions and trade-offs:

- The selector list targets existing class names instead of adding a `reveal`
  class to all nine components — one file changed instead of ten. Cost: adding a
  new section means adding its selector to the list in `Base.astro`.
- Hidden state must be in CSS (not applied by JS) to avoid a flash of visible
  content, so the list is shared with the script through `define:vars` rather
  than duplicated.
- Stagger uses the observer's per-frame entry batch order rather than a computed
  DOM index — good enough for grids, and one line instead of an index map.
- Skipped scroll-driven CSS animations (`animation-timeline: view()`): browser
  support is still uneven and the observer is ~10 lines.
- No test: the behavior is CSS/browser motion with no logic worth asserting;
  verified via `npx astro build` and the emitted `dist/index.html`.

Known follow-ups: none. Nav elevation on scroll was intentionally left out.

## Changelog

- 2026-08-17: Animated the "what it does" feature-card illustrations on reveal
  (rail, mood faces, template thumbs, month grid + streak chain, trend bars,
  privacy lock) plus hover lift on mood tiles and template thumbs.
- 2026-08-17: Added scroll-reveal for all landing and legal page sections, plus
  hero glow/chip/flame idle motion and card, mood tile and screenshot hover
  lifts. Gated behind `prefers-reduced-motion` and JS availability.
