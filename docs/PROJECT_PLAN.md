# Project plan — Дневник чтения

## Current phase

**Phase 1 — Foundation** ← current

## Phases

| # | Phase | Status |
| --- | --- | --- |
| 1 | Foundation | **Current** |
| 2 | Library | Planned |
| 3 | Book search / ISBN | Planned |
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

## Phase 1 scope

- Expo SDK 57 + RN 0.86 + React 19 + TypeScript strict
- Expo Router bottom tabs (5 destinations)
- Design-system tokens and reusable UI primitives
- Versioned SQLite migrations (schema v1)
- Domain model for books, library entries, sessions, notes, shelves, goals
- Centralized settings store (`app_meta`)
- Repository layer + bootstrap with recoverable error UI
- Meaningful Jest coverage for migrations / FKs / archive behavior
- README + this plan

## Explicitly deferred (do not start until requested)

- External book catalogues / Google Books / Open Library
- ISBN scanner
- Full library CRUD UI
- Reading timer
- Streak / calendar / goals UI
- Statistics charts
- Backup / restore / PDF / CSV
- OCR
- Notifications
- AppMetrica / Yandex Ads
- Auth / cloud / social / AI
- Production keystore

## Product principles

- Offline-first personal reading diary
- Everyday actions in 2–3 taps
- Local user data is the source of truth
- Soft-archive over destructive deletes for reading history
