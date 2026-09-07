# Project plan — Дневник чтения

## Current phase

**Phase 11 — OCR quotes** ← DONE  
**Phase 12 — Reminders** ← NEXT

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
| 11 | OCR quotes | **DONE** |
| 12 | Notifications | Planned |
| 13 | UX polish | Planned |
| 14 | AppMetrica + Ads | Planned |
| 15 | Native QA | Planned |
| 16 | RuStore release | Planned |

## Phase 11 scope (DONE)

- On-device quote OCR via `react-native-executorch` (`OCR_RUSSIAN`) — Cyrillic + Latin glyphs
- Flow: capture → process → edit/preview → save QUOTE (never silent)
- Entry: book details «Сканировать цитату», note editor «Сканировать текст»
- Reuses `expo-camera` permissions; temp images cleaned; no cloud photo upload
- Active reading session continues (timestamp timer); no AUDIOBOOK OCR CTA
- Requires custom native / EAS / prebuild (not Expo Go)

## Explicitly deferred

- Reminders / notifications / ads
- Cloud OCR / AI summaries
- Perspective correction / document scanner
