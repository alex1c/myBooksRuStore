# Project plan — Дневник чтения

## Current phase

**Phase 12 — Reminders** ← DONE  
**Phase 13 — UX polish** ← NEXT

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
| 12 | Notifications | **DONE** |
| 13 | UX polish | Planned |
| 14 | AppMetrica + Ads | Planned |
| 15 | Native QA | Planned |
| 16 | RuStore release | Planned |

## Phase 12 scope (DONE)

- Local reading reminders via `expo-notifications` (no remote push / FCM / tokens)
- Settings: Ещё → Напоминания — enable, HH:MM, weekdays (Пн…Вс)
- Android channel `reading-reminders`, default importance
- Permission only after explicit «Включить напоминания»; denied → settings / not now
- Idempotent reschedule; generic calm copy; tap → Today
- Privacy: schedules stay on-device
- Requires custom native / EAS / prebuild (not Expo Go) for production verification

## Phase 11 scope (DONE)

- On-device quote OCR via `react-native-executorch` (`OCR_RUSSIAN`) — Cyrillic + Latin glyphs
- Flow: capture → process → edit/preview → save QUOTE (never silent)
- Entry: book details «Сканировать цитату», note editor «Сканировать текст»
- Reuses `expo-camera` permissions; temp images cleaned; no cloud photo upload
- First use may download the recognition model (photos/text stay local)
- Active reading session continues (timestamp timer); no AUDIOBOOK OCR CTA
- Requires custom native / EAS / prebuild (not Expo Go)

## Explicitly deferred

- UX polish / ads / AppMetrica
- Cloud OCR / AI summaries
- Perspective correction / document scanner
- Dynamic book-title reminder bodies / streak pressure notifications
- Quiet hours automation / multiple reminder times per day
