# Analytics (AppMetrica)

## Configuration

- Config module: `src/config/analytics.ts`
- Production API key: `977b210e-00ab-4cc5-bbce-ed4357b18f38`
- Abstraction: `src/domain/analytics/analyticsService.ts`
- Native adapter: `src/domain/analytics/appMetricaAdapter.ts`
- Test adapter: in-memory via `createMemoryAnalyticsAdapter()`

UI and domain code must call `track(event, params?)` — never AppMetrica SDK directly.

## Initialization

- Best-effort after local SQLite bootstrap succeeds (`src/app/_layout.tsx`).
- Does **not** block splash, onboarding, or Today.
- SDK / network failure → silent; app continues.

## Privacy rules

**Never send:**

- book titles / authors / ISBN
- quotes, thoughts, notes, reviews
- search queries
- OCR text / images
- backup / import filenames
- shelf names
- any personal free text

Development and tests reject forbidden parameter keys (`src/domain/analytics/privacy.ts`).

## Events

| Event | Params |
| --- | --- |
| `onboarding_started` | — |
| `onboarding_completed` | `method`: `completed` \| `skipped` |
| `book_added` | `source`, `format`, `initial_status` |
| `book_status_changed` | `from`, `to` |
| `reading_session_started` | `progress_mode` |
| `reading_session_finished` | `progress_mode`, `duration_bucket` |
| `reading_session_cancelled` | — |
| `quick_progress_used` | `mode` |
| `reading_note_added` | `type` |
| `ocr_started` | — |
| `ocr_completed` | `result` |
| `reading_goal_created` | `type`, `period` |
| `backup_created` | `has_covers` |
| `restore_completed` | — |
| `restore_failed` | `reason` |
| `import_started` | `format` |
| `import_completed` | `format`, `size_bucket` |
| `year_in_books_opened` | — |
| `year_in_books_shared` | `share_type` |
| `reminder_enabled` | `days_count` |
| `reminder_disabled` | — |
| `help_opened` | `section` (fixed enum) |
| `interstitial_shown` | — |

### Duration buckets

`<5m` · `5-15m` · `15-30m` · `30-60m` · `60m+`

### Import size buckets

`1-10` · `11-50` · `51-200` · `201-1000` · `1000+`

## Principles

- Analytics is **best-effort** and never blocks user operations.
- Order is always: **save book → then track**, never the reverse.
- No custom `app_open` (SDK sessions cover this).
- No per-screen view spam in Phase 14.
- Development may log events; production debug logging is off.

## Native rebuild

AppMetrica requires a **dev client / release native build**. Expo Go is not sufficient.
