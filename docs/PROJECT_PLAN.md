# Project plan — Дневник чтения

## Current phase

**Phase 3 — Book search / ISBN** ← DONE  
**Phase 4 — Reading tracker** ← NEXT

## Phases

| # | Phase | Status |
| --- | --- | --- |
| 1 | Foundation | **DONE** |
| 2 | Library | **DONE** |
| 3 | Book search / ISBN | **DONE** |
| 4 | Reading tracker | **NEXT** |
| 5 | Diary / quotes / thoughts | Planned |
| 6 | Calendar / streak / goals | Planned |
| 7 | Statistics | Planned |
| 8 | Year in Books | Planned |
| 9 | Backup / restore / export | Planned |
| 10 | Mass import | Planned |
| 11 | OCR quotes | Planned |
| 12 | Notifications | Planned |
| 13 | UX polish | Planned |
| 14 | AppMetrica + Ads | Planned |
| 15 | Native QA | Planned |
| 16 | RuStore release | Planned |

## Phase 3 scope (DONE)

- Provider abstraction (`BookSearchProvider`) with Open Library implementation
- Debounced search by title / author / ISBN
- ISBN normalization + Bookland EAN-13 scanner (`expo-camera`)
- Preview/add flow with pre-save metadata edit
- Duplicate detection reuse from Phase 2
- Best-effort local cover cache (`remote_cover_url` + `coverUri`)
- Manual add remains fully offline

## Explicitly deferred

- Reading timer / sessions UI (Phase 4)
- Quotes / diary UI (Phase 5)
- Streak / calendar / goals UI (Phase 6)
- Statistics charts (Phase 7)
- Backup / restore / PDF / CSV / OCR
- Notifications / AppMetrica / Yandex Ads
- Auth / cloud / social / AI
- Production keystore

## Product principles

- Offline-first personal reading diary
- External catalogue is metadata-only — never the source of truth
- Everyday actions in 2–3 taps
- Soft-archive over destructive deletes for reading history
