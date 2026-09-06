# Project plan — Дневник чтения

## Current phase

**Phase 5 — Diary / quotes / thoughts** ← DONE  
**Phase 6 — Calendar / streak / goals** ← NEXT

## Phases

| # | Phase | Status |
| --- | --- | --- |
| 1 | Foundation | **DONE** |
| 2 | Library | **DONE** |
| 3 | Book search / ISBN | **DONE** |
| 4 | Reading tracker | **DONE** |
| 5 | Diary / quotes / thoughts | **DONE** |
| 6 | Calendar / streak / goals | **NEXT** |
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

## Phase 5 scope (DONE)

- Notes on existing `reading_notes`: QUOTE / THOUGHT / NOTE
- Fast add from book details, active session, finish screen
- Optional location (page / percent / audio) with smart defaults
- Auto-link to active reading session (`ON DELETE SET NULL`)
- Book details notes section + full book notes screen
- Diary tab timeline: completed sessions + notes, local-day grouping
- Filters (all / sessions / quotes / thoughts / notes) + book filter + search
- Edit / delete / copy / share; dirty-form back guard
- Progress events intentionally excluded from diary (noise)

## Explicitly deferred

- Calendar / streak / goals UI (Phase 6)
- Statistics charts (Phase 7)
- OCR scan-into-quote (Phase 11) — UI reserved a slot near note input
- Favorite quotes / tags / rich text
- Backup / restore / PDF / CSV
- Notifications / AppMetrica / Yandex Ads
- Auth / cloud / social / AI

## Product principles

- Offline-first personal reading diary
- Everyday reading + reflection in few taps
- Soft-archive over destructive deletes for books/history
- Notes may be hard-deleted by explicit user action only
