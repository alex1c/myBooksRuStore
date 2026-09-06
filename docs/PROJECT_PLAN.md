# Project plan — Дневник чтения

## Current phase

**Phase 4 — Reading tracker** ← DONE  
**Phase 5 — Diary / quotes / thoughts** ← NEXT

## Phases

| # | Phase | Status |
| --- | --- | --- |
| 1 | Foundation | **DONE** |
| 2 | Library | **DONE** |
| 3 | Book search / ISBN | **DONE** |
| 4 | Reading tracker | **DONE** |
| 5 | Diary / quotes / thoughts | **NEXT** |
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

## Phase 4 scope (DONE)

- Today as primary workspace: READING cards, quick progress, start session
- Quick progress for PAGES / PERCENT / TIME + exact input + undo snackbar
- Active reading sessions persisted in SQLite (`ended_at IS NULL`)
- Timestamp-based timer (survives background / restart)
- One active session constraint (service + partial unique index)
- Atomic finish: session + library progress + progress event
- Cancel session without changing book progress
- Book completion offer (explicit FINISHED, optional rating later)
- Session history on book details + full history screen
- `reading_progress_events` audit trail (migration 004)

## Explicitly deferred

- Quotes / thoughts / diary timeline (Phase 5)
- Streak / calendar / goals UI (Phase 6)
- Statistics charts (Phase 7)
- Backup / restore / PDF / CSV / OCR
- Notifications / AppMetrica / Yandex Ads
- Auth / cloud / social / AI
- Production keystore
- Full reread cycle model (future enhancement)
- Pause-within-session timer architecture (wall-clock only in 1.0)

## Product principles

- Offline-first personal reading diary
- Everyday reading actions in 2–3 taps
- Soft-archive over destructive deletes for reading history
- External catalogue is metadata-only — never the source of truth
