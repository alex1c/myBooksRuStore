# Project plan — Дневник чтения

## Current phase

**Phase 8 — Year in Books** ← DONE  
**Phase 9 — Backup / restore / export** ← NEXT

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
| 9 | Backup / restore / export | **NEXT** |
| 10 | Mass import | Planned |
| 11 | OCR quotes | Planned |
| 12 | Notifications | Planned |
| 13 | UX polish | Planned |
| 14 | AppMetrica + Ads | Planned |
| 15 | Native QA | Planned |
| 16 | RuStore release | Planned |

## Phase 8 scope (DONE)

- Entry from Statistics → «Мой год в книгах»
- Horizontal paging slides (cover → numbers → pace → month → books → insights → activity → notes → share)
- `getYearInBooks(year)` reuses statisticsService / activityService semantics
- Best streak **within selected year** (cross-year streaks clipped)
- Partial metrics: unavailable vs observed (no fake 0 hours/pages highlights)
- Share card image via `react-native-view-shot` + `expo-sharing`, text fallback
- No ads on Year cards; offline-only; no private notes on share image

## Midnight rule (documented)

Completed sessions attribute activity to the **local calendar day of `startedAt`**.
Overnight sessions are not split; SESSION_END does not invent a second session day.
Page nets from SESSION_END are included so calendar / goals / stats match.

## Explicitly deferred

- Backup / restore / CSV / PDF (Phase 9+)
- OCR / notifications / ads
- Genre analytics (no genre model)
- Separate reread completion cycles
