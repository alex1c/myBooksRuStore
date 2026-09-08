# Project plan — Дневник чтения

## Current phase

**Phase 14 — AppMetrica + Yandex Ads** ← DONE  
**Phase 15 — Final native QA** ← NEXT

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
| 13 | UX polish | **DONE** |
| 13b | Onboarding & Help | **DONE** |
| 14 | AppMetrica + Ads | **DONE** |
| 15 | Native QA | Planned |
| 16 | RuStore release | Planned |

## Phase 14 scope (DONE)

- AppMetrica mobile SDK + central `analyticsService` (privacy-safe events)
- Yandex Mobile Ads + `AppBanner` (3 banner groups) + gated interstitial
- Docs: `docs/ANALYTICS.md`, `docs/ADS.md`
- Unit tests for privacy, banner/interstitial policy, navigation safety

## Explicitly deferred

- Production signing / AAB / RuStore listing (Phase 15–16)
- Cloud sync / social
- Forced re-onboarding after updates / What's New
