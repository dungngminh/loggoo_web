# Legal pages (terms, licence, privacy)

## Summary

- **What it does:** Publishes the three documents both app stores link to — `/terms` (the service agreement), `/eula` (the end user licence agreement, containing the minimum terms Apple requires of a custom EULA), and `/privacy` (the policy, documented separately in `store-privacy-declarations.md`).
- **Primary journey:** A reviewer or a user taps *terms of service* / *licence agreement* in the site footer, in the app's settings, or on the paywall → lands on a Legal-layout page → the same text is what App Store Connect and Play Console point at.
- **Why a custom EULA:** loggoo sells an auto-renewable subscription. Using Apple's standard EULA is allowed, but a custom one lets the licence state the subscription mechanics and the app-specific restrictions (no watermark removal, no entitlement tampering) in the same document the paywall links to. A custom EULA is only accepted if it carries Apple's Schedule A minimum terms — those are section 12 of `/eula`.
- **Status:** shipped. The plain-text copy for App Store Connect is `docs/eula-app-store-connect.txt`.

## Implementation

- **Key files**
  - `src/pages/eula.astro` — the licence. Sections 1–11 are the licence itself; **section 12 carries Apple's minimum terms verbatim in substance** (acknowledgement, scope of licence, maintenance and support, warranty + Apple's refund obligation, product claims, IP rights, legal compliance, third-party terms, third-party beneficiary). Do not delete or soften section 12 — a custom EULA without it is rejected.
  - `src/pages/terms.astro` — §2 now defers to `/eula` for the software licence; §6 was rewritten from "sold as a one-time in-app purchase" to the real model (auto-renewable subscription, lifetime in some offerings) with the renewal/cancellation disclosure Apple's guideline 3.1.2 expects.
  - `src/components/Footer.astro` — added the *licence agreement* link between terms and privacy.
  - `src/data/site.ts` — `legal.updated` drives the "last updated" line on all three pages; bump it whenever any of them changes.
  - `src/layouts/Legal.astro` — shared layout; `legal__panel`, `legal__checks`, `legal__items`, `legal__contact` are the available blocks.
- **Where each document is used**

  | Surface | Points at |
  | --- | --- |
  | App Store Connect → App Information → License Agreement (custom) | text of `docs/eula-app-store-connect.txt` |
  | App Store Connect → App Privacy | `https://loggoo.app/privacy` |
  | Play Console → Store listing / Data safety | `https://loggoo.app/privacy` |
  | App paywall (`PaywallScreen.kt`) and settings (`SettingsScreen.kt`) in `loggoo_app` | `https://loggoo.app/terms` + `/privacy` |

- **Regenerating the App Store Connect text.** The ASC License Agreement field takes plain text, not a URL, so it is derived from the built page rather than maintained twice. After editing `eula.astro`, run `npm run build`, then strip the article out of `dist/eula/index.html` into `docs/eula-app-store-connect.txt` (block tags → blank lines, `<li>` → `- `, whitespace collapsed) and re-insert the three absolute URLs (`/eula`, `/terms`, `/privacy`) that the HTML carries as relative links. Current size: ~8.9k characters, inside ASC's 10k limit — keep it there.
- **Notable decisions**
  - The EULA is a separate page rather than a section of `/terms`, because App Store Connect wants a single self-contained licence document and the paywall's "terms of use" link should be able to reach exactly that text.
  - Section 5 (billing) deliberately does not name prices or plan lengths: those differ per RevenueCat offering and per A/B variant, and the store screen is the authoritative disclosure. The EULA states the *mechanics* (auto-renew, 24-hour window, cancellation path, trial forfeiture).
  - Lowercase headings match the rest of the site; casing has no bearing on enforceability.
- **Known follow-ups**
  - Consider repointing `TERMS_URL` in `app/shared/.../feature/paywall/ui/PaywallScreen.kt` from `/terms` to `/eula` so the paywall's required "terms of use" link lands on the licence itself.
  - `/terms` §12 and `/eula` §11 both say "the jurisdiction in which KomKat Studio is established" — replace with the named jurisdiction once the studio's registration is settled.

## Changelog

- 2026-09-05: Added `/eula` (custom end user licence agreement including Apple's Schedule A minimum terms in section 12) plus the App Store Connect plain-text copy; rewrote `/terms` §6 for the real subscription model and pointed §2 at the new licence; added the footer link and bumped `legal.updated`.
