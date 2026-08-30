# Store privacy declarations

## Summary

- **What it does:** Keeps `/privacy` truthful about every SDK that receives data from the loggoo app, and holds the exact answers to fill into the **App Store Connect privacy label** and the **Google Play Data Safety** form so both consoles match the published policy.
- **Primary journey:** A release is being prepared → open this doc → copy the answers into App Store Connect (App Privacy) and Play Console (Data safety) → point both consoles at `https://loggoo.app/privacy`.
- **Source of truth for the app side:** `loggoo_app/docs/features/push-notifications.md`, `firebase-analytics.md`, `purchases-revenuecat.md`, `icloud-sync.md`.
- **Status:** shipped (policy page); the console forms are filled by hand from the tables below.

## Implementation

- **Key files:** `src/pages/privacy.astro` (the published policy), `src/data/site.ts` (`legal.updated`).
- **SDKs that receive data**

  | SDK | What leaves the device | Purpose |
  | --- | --- | --- |
  | Firebase Analytics | app instance id, bounded product events (`record_logged` with type/hour/day/mood, `streak_updated`, `frame_export_*`, `screen_view`, `icloud_sync_*`), device model, OS, app version, coarse region from IP | analytics |
  | Firebase Crashlytics | stack trace, installation UUID, device model, OS, app version | app functionality / diagnostics |
  | Firebase Remote Config | app instance id, app/device metadata | app functionality |
  | OneSignal | push token, subscription id, device model, OS, app version, language, IP (coarse country + timezone) and the tag set: `last_log_at`, `first_entry_at` (hour-floored), `streak_days`, `longest_streak`, `total_entries`, `is_plus`, `reminder_armed`, `reminder_hour` | app functionality (push delivery and targeting) |
  | RevenueCat | anonymous app user id, store receipt/transaction, store country, entitlement state | app functionality (purchases) |
  | Apple CloudKit (iOS, plus, opt-in) | entries and media into the **user's own** private iCloud database | app functionality |

  Journal content — photos, videos, note text, exact timestamps — never leaves the device except into the user's own iCloud.

### App Store privacy label (App Store Connect → App Privacy)

Tracking: **No**. No data is used for tracking, no ad identifiers, no data brokers → no ATT prompt.

| Data type | Collected | Linked to user | Purposes |
| --- | --- | --- | --- |
| Identifiers → Device ID | Yes (push token/subscription id, app instance id, RevenueCat app user id) | Not linked | App Functionality, Analytics |
| Usage Data → Product Interaction | Yes | Not linked | Analytics, App Functionality |
| Usage Data → Other Usage Data | Yes (streak/entry counts sent as OneSignal tags) | Not linked | App Functionality |
| Diagnostics → Crash Data | Yes | Not linked | App Functionality, Analytics |
| Diagnostics → Performance Data | Yes | Not linked | App Functionality, Analytics |
| Purchases → Purchase History | Yes | Not linked | App Functionality |
| Photos or Videos, User Content, Contact Info, Contacts, Location, Health, Search/Browsing History, Sensitive Info, Financial Info (other than purchase history), Other Data | **Not collected** | — | — |

Data in the user's own CloudKit private database is not declared as collected — it is stored under the user's Apple ID, not received by us.

### Google Play Data Safety (Play Console → App content → Data safety)

Answers to the framing questions: data **is** collected; data is **not shared** with third parties (every SDK is a processor acting on our instructions); all data is **encrypted in transit**; users **can request deletion** (in-app *settings → delete all data*, plus `komkat.studio@gmail.com`); the app is **not** designed for children; independent security review: no.

| Data type | Collected | Shared | Optional? | Purposes |
| --- | --- | --- | --- | --- |
| App activity → App interactions | Yes | No | Required | Analytics, App functionality |
| App activity → Other user-generated content — **do not select** (journal content stays local) | No | — | — | — |
| App info and performance → Crash logs | Yes | No | Required | Analytics, App functionality |
| App info and performance → Diagnostics | Yes | No | Required | Analytics, App functionality |
| Device or other IDs → Device or other IDs | Yes | No | Required | App functionality (push), Analytics |
| Financial info → Purchase history | Yes | No | Optional (only if the user buys) | App functionality |
| Photos, Videos, Audio, Files, Personal info, Location, Contacts, Messages, Health | No | — | — | — |

**Advertising ID declaration (Play Console → App content → Advertising ID):** loggoo shows no ads. `firebase-analytics` and the OneSignal SDK pull `com.google.android.gms.permission.AD_ID` and the `ACCESS_ADSERVICES_*` permissions into the merged manifest, so either answer "yes, the app uses advertising ID" for analytics, or strip the permission in `app/androidApp/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="com.google.android.gms.permission.AD_ID" tools:node="remove" />
```

Removing it is the answer that matches this policy, which states no advertising identifiers are collected. Verify with `./gradlew :app:androidApp:processReleaseMainManifest` and grep the merged manifest.

- **Notable decisions:** the policy names each processor rather than saying "a crash-reporting provider", because both store forms require naming the data a third-party SDK receives anyway. The OneSignal tag set is spelled out in section 5 so the "Other usage data" label entry has something a user can read.
- **Known follow-ups:** decide and apply the AD_ID answer in `loggoo_app` before the next Play release; add a data-deletion URL if Play later requires a web form instead of an email address.

## Changelog

- 2026-08-30: Rewrote `/privacy` for the shipped stack — OneSignal push (token, subscription id, tag set), Firebase Analytics/Crashlytics/Remote Config, RevenueCat, iOS-only iCloud sync — and recorded the App Store privacy label and Play Data Safety answers plus the AD_ID caveat.
