# Bilingual iOS User Guide Design

## Goal

Publish a complete, approachable iOS user guide for Loggoo at `/guide`. The page must explain the app in both English and Vietnamese, use the names users see in the app, and embed an optimized GIF made from the supplied Home Widget recording.

## Audience and scope

The guide is for new and existing iPhone users who want task-oriented instructions without technical detail. It covers the shipped iOS journeys visible to a user:

1. Get started with onboarding.
2. Capture a photo or Plus video.
3. Add a mood or note.
4. Browse, edit, and remove timeline entries.
5. Navigate days and the month calendar.
6. Build, save, and share a frame.
7. View Mood Trends and Recap stories.
8. Add and use the three Home Screen Widgets.
9. Configure journal reminders.
10. Choose mood faces, a default frame, and other preferences.
11. Use iCloud sync, Loggoo Plus, and restore purchases.
12. Resolve common permission and content issues and understand local privacy behavior.

Android-specific installation and UI instructions are out of scope. Shared features may be described only from the iOS user's perspective. Features documented by the app as not built, such as Recap MP4 export, must not be presented as available.

## Information architecture

Create one statically generated Astro page at `/guide` with:

- A compact hero containing the page title, summary, and language switch.
- A linked table of contents.
- One task-focused section per guide topic.
- Numbered steps with short explanations, occasional tips, and explicit Plus labels where entitlement is required.
- A troubleshooting and privacy section at the end.

English and Vietnamese share exactly the same section structure. The Vietnamese copy keeps the English label of an in-app control in parentheses where this helps readers match the instructions to the current English app UI.

## Localization model

Keep both language variants in one typed content structure. Render both into the static page so the guide remains usable without client-side fetching. A small inline script switches the visible locale, updates the active switch state, sets the document language, and stores the choice in `localStorage`.

English is the default when no choice has been saved. The switch must remain a real accessible control with a clear selected state. The page must not depend on a localization framework or add a runtime dependency.

## Visual design

Follow the existing Loggoo website tokens, typography, card shapes, spacing, and warm palette. Add only the guide-specific layout styles needed for readable long-form content:

- Comfortable text width and hierarchy.
- A responsive table of contents.
- Distinct step numbers, tips, and Plus badges.
- Clear focus states and touch targets.
- Mobile-first behavior that also uses desktop width well.

Add `Guide` to the primary navigation and `User guide` to the footer. The new links must work from the home page, legal pages, and guide page.

## Home Widget media

Convert `/Users/dungngminh/Downloads/ScreenRecording_09-06-2026 13-18-28_1.MP4` to an animated GIF for the Home Screen Widgets section. Preserve the meaningful sequence: finding Loggoo in the iOS widget gallery, previewing the Day/Mood/Streak widgets, adding a widget, and using a widget shortcut to enter the app.

Optimize the GIF for the web by trimming idle frames if useful, scaling down the 1180×2556 source, lowering frame rate, and generating an optimized palette. Keep the result legible on an iPhone-sized presentation while avoiding an unnecessarily large download. Render it directly in the guide with intrinsic dimensions, lazy loading, descriptive alternative text, and a caption.

## Content accuracy

Ground the guide in the current app source and feature documentation. Important product constraints that must be reflected include:

- Loggoo is offline-first and stores journal media privately by default.
- A long press on the camera shutter records video only when Loggoo Plus and the device support it; otherwise it captures a photo.
- Past days can be filled in, but doing so does not extend a streak.
- Frame Studio supports Story and Post aspects, multiple templates, photo and mood selection, and save/share; some templates require Plus.
- Recap playback is available, but MP4 export is not.
- Home widgets are launchers, not inline editors, and all three widget kinds require Plus.
- iCloud sync is an iOS-only Plus feature and should be enabled with the same Apple ID/iCloud configuration on participating devices.
- Permission troubleshooting must not promise behavior the app or iOS cannot provide.

## Accessibility and resilience

- Use semantic headings in order and real ordered lists for instructions.
- Keep every interactive control keyboard-accessible and visibly focused.
- Mark the active language with `aria-pressed` or an equivalent state.
- Give the GIF useful alternative text and supporting copy, so the procedure does not depend on animation.
- Respect `prefers-reduced-motion`; the written steps remain the primary source of instruction.
- If storage APIs are unavailable, the English guide remains visible and switching languages still works for the current page view.

## Verification and delivery

Before delivery:

1. Confirm every English section has a Vietnamese equivalent and the section IDs and table-of-contents links remain valid in both languages.
2. Verify feature names and limitations against the current app documentation and source.
3. Inspect the GIF dimensions, duration, and file size and check that it renders responsively.
4. Run `npm run build` in `loggoo_web`.
5. Review the final diff for temporary files, secrets, and unrelated edits.
6. Commit all changes with an imperative documentation-scoped subject and push directly to `origin/main`, as authorized by the user.

No runtime behavior tests are required because this is a static documentation page. The Astro production build is the required automated validation; the generated page and language control receive focused markup/content review.
