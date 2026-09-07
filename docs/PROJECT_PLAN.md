# Project plan — Дневник чтения

## Current phase

**Phase 10 — Mass import** ← DONE  
**Phase 11 — OCR quotes** ← NEXT

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
| 11 | OCR quotes | Planned |
| 12 | Notifications | Planned |
| 13 | UX polish | Planned |
| 14 | AppMetrica + Ads | Planned |
| 15 | Native QA | Planned |
| 16 | RuStore release | Planned |

## Phase 10 scope (DONE)

- Offline CSV import pipeline: parse → normalize → validate → preview → duplicates → atomic commit → report
- Formats: our Phase 9 CSV, Goodreads export, generic CSV with column mapping
- Delimiters `;` / `,` / tab; UTF-8 (+ BOM); quoted multiline fields
- Duplicate policies: skip (default) / add as another edition; within-file first-wins
- No fake reading activity (no sessions / progress events from historical import)
- Entry: Ещё → Импорт

## Explicitly deferred

- OCR / notifications / ads
- Cloud backup providers
- Unsafe auto-merge update of existing books on import
