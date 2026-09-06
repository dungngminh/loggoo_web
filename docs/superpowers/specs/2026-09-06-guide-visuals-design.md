# User Guide Visuals Design

## Goal

Make the bilingual iOS guide easier to scan and understand by pairing each topic with a real Loggoo screen, while correcting the duplicated numbers in the table of contents.

## Media selection

Use current Loggoo screenshots already committed to the app or website repositories. Each of the twelve guide topics receives one representative visual. Capture and Frame Studio receive two visuals because their before/after states are central to the task. Combined topics may also use two images where one screen cannot truthfully represent both features:

- Getting started: onboarding mood screen.
- Capture: ready camera and moment composer.
- Moods and notes: mood sheet and note sheet.
- Timeline: populated timeline and entry detail.
- Calendar: month view.
- Frames: Hero and Polaroid frame previews.
- Trends and Recap: Mood Trends and Recap setup.
- Widgets: the existing Home Widget GIF.
- Reminders: first-log reminder prompt.
- Personalization: Settings.
- iCloud and Plus: iCloud status and paywall.
- Troubleshooting: camera permission-denied state.

Every image has localized alternative text and a short localized caption. Images load lazily and declare intrinsic dimensions.

## Layout

On desktop, each guide section places its steps and notes in the left column and a narrow screenshot gallery in the right column. One image uses the full gallery width; two images sit as overlapping or adjacent phone cards without obscuring important controls. On small screens, the gallery moves above the steps and becomes a horizontally scrollable row so screenshots remain readable without making the page excessively long.

Use the existing warm card, border, radius, and shadow tokens. Do not add a lightbox or new JavaScript. The language switch continues to choose the matching captions and alternative text because media metadata remains inside each localized content object.

## Table-of-contents correction

Keep the existing ordered semantic list but hide its browser-generated markers. The visible section titles already begin with their canonical number, so this produces one number per item without changing section headings or anchors.

## Verification

- Confirm every guide section renders at least one image or the widget GIF.
- Confirm both locales carry the same media paths and localized descriptions.
- Verify image paths and intrinsic sizes.
- Run the Astro production build.
- Re-run the duplicate-ID and missing-anchor checks.
- Review the generated guide at desktop and mobile breakpoints through its responsive CSS structure.
