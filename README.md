# Дневник чтения

Личный offline-first дневник чтения для Android / RuStore.

Это не социальная сеть и не онлайн-читалка. Основные повседневные действия
должны выполняться за 2–3 касания, без регистрации и без интернета.

## Repository

| Role | Path / URL |
| --- | --- |
| Remote Cursor | `D:\PetProject\myBooksRuStore` |
| Local Codex | `D:\petProject\myBooksRuStore` |
| GitHub (source of truth) | https://github.com/alex1c/myBooksRuStore |
| Default branch | `main` |
| Android package | `com.calculatorplatform.mybooks` |
| Display name | Дневник чтения |
| Internal slug | `my-books` |
| Version | `1.0.0` (versionCode `1`) |

**GitHub is the source of truth.** Sync both machines through `origin/main`.

## Two-computer workflow

1. Finish work on Cursor (`D:\PetProject\myBooksRuStore`).
2. Commit and push to `origin/main`.
3. On the Codex machine (`D:\petProject\myBooksRuStore`): `git pull origin main`.
4. Run checks locally before continuing the next phase.

## Stack

- Expo SDK 57
- React Native 0.86
- React 19
- TypeScript (strict)
- Expo Router (tabs)
- Expo SQLite
- Jest + ESLint
- Android / RuStore oriented

## Main commands

```bash
npm install
npm start
npm run android
npm run lint
npm run typecheck
npm test
npm run doctor
npm run check
```

## Architecture overview

```
src/
  app/                 # Expo Router screens (5 tabs + stacks)
  components/          # UI + ads (AppBanner) + feature widgets
  config/              # AppMetrica + Yandex Ads IDs (centralized)
  constants/           # Theme tokens, copy, domain enums
  context/             # Database provider
  db/                  # SQLite open, migrations, repositories
  domain/              # Library, reading, analytics, ads policies
  hooks/               # App bootstrap
  services/            # Logging, book search, covers
  utils/               # IDs, dates, formatters
docs/                  # PROJECT_PLAN, ANALYTICS, ADS
__tests__/             # Jest tests
```

### Layering

```
UI (screens)
  → hooks / domain / services
    → repositories
      → SQLite (SqlExecutor)
```

Screens must not embed raw SQL.

### Domain rule

**Book ≠ LibraryEntry.**

- `books` — catalog / reference metadata (title, author, ISBN, cover…)
- `library_entries` — user state (status, format, progress, rating…)
- Reading history (`reading_sessions`, `reading_notes`) references
  `library_entries` with `ON DELETE RESTRICT`
- Soft-archive via `archived_at` keeps history intact when a book leaves
  the active library

### Startup flow

1. App launches (no network wait)
2. SQLite opens (`mybooks.db`)
3. Migrations apply
4. Settings defaults are ensured in `app_meta`
5. Tab UI becomes available
6. DB errors show a Russian recoverable fallback (no blank screen)

### Navigation

1. Сегодня
2. Библиотека
3. Дневник
4. Статистика
5. Ещё

### Database / migrations

- Migrations live in `src/db/migrations/`
- Version registry table: `schema_migrations`
- Apply via `applyMigrations()` during bootstrap
- Never edit already-shipped migration SQL — append a new version

**Schema v1 tables:** `books`, `library_entries`, `reading_sessions`,
`reading_notes`, `shelves`, `library_entry_shelves`, `reading_goals`,
`app_meta`, `schema_migrations`

**Schema v2:** `library_entries.finished_date_precision` (`EXACT` | `YEAR` |
`UNKNOWN`), `finished_year`, `finished_on` (YYYY-MM-DD for exact dates)

**Schema v3:** `books.remote_cover_url` (original catalogue cover URL;
`cover_uri` may point to a locally cached file)

**Schema v4:** active reading sessions (`ended_at` / `duration_seconds`
nullable), partial unique index for one active session,
`reading_progress_events` audit trail

**Schema v5:** activity query index on `reading_progress_events(type, created_at)`

### Statuses

`WANT_TO_READ` · `READING` · `FINISHED` · `PAUSED` · `ABANDONED`

### Formats

`PAPER` · `EBOOK` · `AUDIOBOOK`

### Progress modes

`PAGES` · `PERCENT` · `TIME`

### Settings (centralized in `app_meta`)

- reminder enabled / reminder time
- default progress mode
- theme preference
- onboarding state
- analytics consent (nullable until asked)

### Dates

- Instants: ISO-8601 UTC (`…Z`)
- Future calendar stats: local `YYYY-MM-DD` via `toDateOnlyLocal()`

### IDs

Opaque string IDs (`createId('book')`, …) — not SQLite autoincrement —
to keep backup/import/merge straightforward later.

## Current phase

**Phase 14 — AppMetrica + Yandex Ads** (complete). Phase 15 (final native QA) is next.

See `docs/ANALYTICS.md` and `docs/ADS.md`.

First launch shows a short 4-step guide (skippable). Permanent help lives under
Ещё → Как пользоваться.

Local reading reminders via `expo-notifications` (no remote push). Settings live under
Ещё → Напоминания. Notification verification needs a native / EAS Android build — Expo Go
is not enough.

Manual library + Open Library search/ISBN scan. Offline core remains fully usable
when the network is unavailable. Statistics, Year in Books, and backup/export are
local-only — files are never uploaded automatically. OCR photos/text stay on-device;
the recognition model may download on first use.
