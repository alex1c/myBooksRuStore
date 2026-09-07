# Project plan — Дневник чтения

## Current phase

**Phase 9 — Backup / restore / export** ← DONE  
**Phase 10 — Mass import** ← NEXT

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
| 10 | Mass import | **NEXT** |
| 11 | OCR quotes | Planned |
| 12 | Notifications | Planned |
| 13 | UX polish | Planned |
| 14 | AppMetrica + Ads | Planned |
| 15 | Native QA | Planned |
| 16 | RuStore release | Planned |

## Phase 9 scope (DONE)

- Structured ZIP backup (`manifest.json` + `data.json` + `covers/`), formatVersion 1, SHA-256
- Full replace restore with validation, FK check, atomic transaction
- Round-trip preserves IDs, relations, archives, active sessions, finished precision
- CSV library export (UTF-8 BOM, `;`, escaping)
- PDF library report via expo-print (filters, escaped HTML, Russian labels)
- Entry: Ещё → Резервная копия / Экспорт данных
- No cloud sync; no merge import (Phase 10)

## Explicitly deferred

- Mass import / Goodreads CSV import (Phase 10)
- OCR / notifications / ads
- Cloud backup providers
