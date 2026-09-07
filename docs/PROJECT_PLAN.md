# Project plan — Дневник чтения

## Current phase

**Phase 7 — Statistics** ← DONE  
**Phase 8 — Year in Books** ← NEXT

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
| 8 | Year in Books | **NEXT** |
| 9 | Backup / restore / export | Planned |
| 10 | Mass import | Planned |
| 11 | OCR quotes | Planned |
| 12 | Notifications | Planned |
| 13 | UX polish | Planned |
| 14 | AppMetrica + Ads | Planned |
| 15 | Native QA | Planned |
| 16 | RuStore release | Planned |

## Phase 7 scope (DONE)

- Statistics tab: period selector (7 / 30 / 90 / year / all), summary, charts, insights
- Reuses activity / streak / goals services (single page-delta + reading-day semantics)
- Summary: finished books, net pages, session time, reading days
- Charts: time|pages series; monthly completed books for year/all
- Formats, ratings, top books by session duration, sessions, notes, library overview
- Date precision: EXACT / YEAR / UNKNOWN (honest annual vs monthly totals)
- Offline-only aggregation via `statisticsService`
- No stored statistics table; no migration 006 (indexes already sufficient)

## Midnight rule (documented)

Completed sessions attribute activity to the **local calendar day of `startedAt`**.
Overnight sessions are not split; SESSION_END does not invent a second session day.
Page nets from SESSION_END are included so calendar / goals / stats match.

## Explicitly deferred

- Year in Books / Wrapped share cards (Phase 8)
- Backup / OCR / notifications / ads
- Genre analytics (no genre model)
- Separate reread completion cycles
