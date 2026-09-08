# Ads (Yandex Mobile Ads)

## Configuration

- Config module: `src/config/ads.ts`
- Abstraction: `src/domain/ads/adsService.ts`
- Interstitial policy (pure): `src/domain/ads/interstitialPolicy.ts`
- Banner policy (pure): `src/domain/ads/bannerPolicy.ts`
- UI component: `src/components/ads/AppBanner.tsx`

## Production placements

| Placement | ID | Screens |
| --- | --- | --- |
| Banner 1 | `R-M-20004307-1` | Сегодня, Библиотека |
| Banner 2 | `R-M-20004307-2` | Дневник, Статистика |
| Banner 3 | `R-M-20004307-3` | Ещё |
| Interstitial | `R-M-20004307-4` | Safe tab transitions only |

## Development / test mode

In `__DEV__`, official Yandex demo units are used:

- `demo-banner-yandex`
- `demo-interstitial-yandex`

Production IDs remain in config for release builds. Do **not** click production ads during QA.

## Banner rules

- Layout slot above bottom tabs (not overlay).
- Silent failure — no error toasts; collapse when unavailable.
- SDK refresh only — no aggressive re-fetch on every focus.
- **Hidden on Today while an active reading session exists.**
- No banners on: onboarding, active session screen, finish flow, forms, OCR, backup/restore/import/export, Year in Books, help articles, reminders setup.

## Interstitial rules

- **Max 1 per app session** (in-memory only).
- Not before **~3 minutes** after cold start (`ADS_INTERSTITIAL_MIN_ELAPSED_MS`).
- At least **4 meaningful actions** (tab navigation, book details open, …).
- **Whitelist contexts only:** `LIBRARY`, `DIARY`, `STATISTICS`, `MORE`.
- Never during reading start/finish/cancel, notes, OCR, backup/import/export, Year in Books, onboarding, help, book completion, permissions.
- Preload after startup (best-effort); never auto-show from preload.
- Failure / not-ready → continue navigation; ~1 minute attempt cooldown.
- After show → do not preload another interstitial for this session.
- Never chain banner → interstitial.

## Offline

App works fully offline. Ad and analytics failures are silent.

## Native rebuild

Yandex Mobile Ads requires a **fresh native Android build** (prebuild / EAS). Expo Go is not sufficient for ads QA.
