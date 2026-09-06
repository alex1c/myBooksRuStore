# Project plan — Дневник чтения

## Current phase

**Phase 2 — Library** ← DONE  
**Phase 3 — Book search / ISBN** ← NEXT

## Phases

| # | Phase | Status |
| --- | --- | --- |
| 1 | Foundation | **DONE** |
| 2 | Library | **DONE** |
| 3 | Book search / ISBN | **NEXT** |
| 4 | Reading tracker | Planned |
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

## Phase 1 scope (DONE)

- Expo SDK 57 + RN 0.86 + React 19 + TypeScript strict
- Expo Router bottom tabs (5 destinations)
- Design-system tokens and reusable UI primitives
- Versioned SQLite migrations (schema v1)
- Domain model for books, library entries, sessions, notes, shelves, goals
- Centralized settings store (`app_meta`)
- Repository layer + bootstrap with recoverable error UI

## Phase 2 scope (DONE)

- Manual add / edit / details for local library
- Search, status filters, sorting
- Progress modes: PAGES / PERCENT / TIME
- Statuses, formats, optional rating (0–5 / 0.5) and review
- Finished-date precision: EXACT / YEAR / UNKNOWN (schema v2)
- Soft archive + restore
- User shelves (create / rename / archive / attach)
- Today tab shows real READING books
- Duplicate detection (title+author / ISBN)
- Transactional add/update across books + entries + shelves

## Explicitly deferred

- External catalogues / Google Books / Open Library / ISBN scanner (Phase 3)
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
- Everyday actions in 2–3 taps
- Local user data is the source of truth
- Soft-archive over destructive deletes for reading history
- Book catalog ≠ library entry user state
