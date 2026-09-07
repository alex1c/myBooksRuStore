# Project plan — Дневник чтения

## Current phase

**Phase 13 — UX polish** ← DONE  
**Phase 14 — AppMetrica + Yandex Ads** ← NEXT

## Phases

| # | Phase | Status |
| --- | --- | --- |
| 1 | Foundation | **DONE** |
| 2 | Library | **DONE** |
| 3 | Book search / ISBN | **DONE** |
| 4 | Reading tracker | **DONE** |
| 5 | Diary / quotes / thoughts | **DONE** |
| 6 | Calendar / streak / goals | **DONE** |
| 7 | Statistics | **DONE** |
| 8 | Year in Books | **DONE** |
| 9 | Backup / restore / export | **DONE** |
| 10 | Mass import | **DONE** |
| 11 | OCR quotes | **DONE** |
| 12 | Notifications | **DONE** |
| 13 | UX polish | **DONE** |
| 14 | AppMetrica + Ads | Planned |
| 15 | Native QA | Planned |
| 16 | RuStore release | Planned |

## Phase 13 scope (DONE)

- Shared form/search/feedback helpers (`SearchField`, `FeedbackSnackbar`, `DestructiveButton`, `useDirtyFormGuard`)
- Today: single FlatList + header, compact goals, hide competing Start CTA during active session
- Library/Diary: clearable search, filter empty recovery, diary debounce
- Book details: Edit secondary, Archive destructive, Russian finished dates, note plurals
- Dirty protection on book edit + notes; success feedback without blocking Alerts where practical
- Stress fixtures (1000 books) for list/empty UX tests — not production seeding

## Explicitly deferred

- AppMetrica / Yandex Ads (Phase 14)
- Cloud sync / social
- Heavy visual redesign / tablet layouts
