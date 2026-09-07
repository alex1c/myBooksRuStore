# Project plan — Дневник чтения

## Current phase

**Phase 6 — Calendar / streak / goals** ← DONE  
**Phase 7 — Statistics** ← NEXT

## Phases

| # | Phase | Status |
| --- | --- | --- |
| 1 | Foundation | **DONE** |
| 2 | Library | **DONE** |
| 3 | Book search / ISBN | **DONE** |
| 4 | Reading tracker | **DONE** |
| 5 | Diary / quotes / thoughts | **DONE** |
| 6 | Calendar / streak / goals | **DONE** |
| 7 | Statistics | **NEXT** |
| 8 | Year in Books | Planned |
| 9 | Backup / restore / export | Planned |
| 10 | Mass import | Planned |
| 11 | OCR quotes | Planned |
| 12 | Notifications | Planned |
| 13 | UX polish | Planned |
| 14 | AppMetrica + Ads | Planned |
| 15 | Native QA | Planned |
| 16 | RuStore release | Planned |

## Phase 6 scope (DONE)

- Activity tab (бывшая «Статистика»): streak, month calendar, goals
- Reading day = completed session (duration > 0, by `startedAt` local day) OR net positive progress events (quick/manual/finish; undo nets out; SESSION_END not double-counted for days)
- Local timezone day keys via `toLocalDayKey` / period helpers (Monday-first weeks)
- Streak: current + best; today-pending friendly semantics
- Goals: BOOKS / PAGES / MINUTES × DAY / WEEK / MONTH / YEAR on `reading_goals`
- Pages from progress events (incl. SESSION_END + UNDO net); minutes from session duration only
- Books: EXACT in period; YEAR precision only for annual goals; UNKNOWN excluded
- Today compact daily/weekly goal strip
- Migration 005: activity query index

## Midnight rule (documented)

Completed sessions attribute activity to the **local calendar day of `startedAt`**.
Overnight sessions are not split; SESSION_END does not add a second activity day.

## Explicitly deferred

- Advanced charts / analytics dashboard (Phase 7)
- Year in Books, backup/OCR/notifications/ads
- Goal completion history charts
