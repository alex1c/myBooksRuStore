/**
 * Yandex Mobile Ads native adapter (interstitial load/show).
 * Banner rendering stays in AppBanner via BannerView.
 */

import { resolveInterstitialAdUnitId } from '@/config/ads'
import { logger } from '@/services/logging'
import type { AdsAdapter } from './adsAdapter'

type InterstitialAdLike = {
	show: () => void
	onAdShown: (() => void) | null
	onAdFailedToShow: ((error?: unknown) => void) | null
	onAdDismissed: (() => void) | null
}

type YandexAdsModule = {
	MobileAds: {
		initialize: () => Promise<void> | void
		enableLogging?: (enabled: boolean) => void
	}
	InterstitialAdLoader: {
		create: () => Promise<{
			loadAd: (params: { adUnitId: string }) => Promise<InterstitialAdLike>
		}>
	}
}

function tryLoadYandex (): YandexAdsModule | null {
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const mod = require('yandex-mobile-ads') as YandexAdsModule
		if (!mod?.MobileAds?.initialize || !mod?.InterstitialAdLoader?.create) {
			return null
		}
		return mod
	} catch (error) {
		if (typeof __DEV__ !== 'undefined' && __DEV__) {
			logger.warn('Yandex Mobile Ads module unavailable', { error })
		}
		return null
	}
}

/**
 * Creates the production Yandex interstitial adapter.
 */
export function createYandexAdsAdapter (): AdsAdapter {
	let sdk: YandexAdsModule | null = null
	let loadedAd: InterstitialAdLike | null = null
	let loading = false

	async function loadAd (): Promise<void> {
		if (!sdk || loading || loadedAd) {
			return
		}
		loading = true
		try {
			const loader = await sdk.InterstitialAdLoader.create()
			const adUnitId = resolveInterstitialAdUnitId()
			const ad = await loader.loadAd({ adUnitId })
			loadedAd = ad
		} catch (error) {
			loadedAd = null
			if (typeof __DEV__ !== 'undefined' && __DEV__) {
				logger.warn('Interstitial preload failed', { error })
			}
		} finally {
			loading = false
		}
	}

	return {
		async initialize () {
			sdk = tryLoadYandex()
			if (!sdk) {
				return
			}
			try {
				if (typeof __DEV__ !== 'undefined' && __DEV__ && sdk.MobileAds.enableLogging) {
					sdk.MobileAds.enableLogging(true)
				}
				await sdk.MobileAds.initialize()
			} catch (error) {
				logger.warn('Yandex MobileAds.initialize failed', { error })
				sdk = null
			}
		},
		async preloadInterstitial () {
			await loadAd()
		},
		isInterstitialReady () {
			return loadedAd != null
		},
		async showInterstitial () {
			const ad = loadedAd
			if (!ad) {
				return { shown: false }
			}
			loadedAd = null
			return new Promise((resolve) => {
				let settled = false
				const finish = (shown: boolean) => {
					if (settled) {
						return
					}
					settled = true
					resolve({ shown })
				}
				ad.onAdShown = () => {
					// Mark shown; wait for dismiss to resume navigation intent.
				}
				ad.onAdFailedToShow = () => {
					finish(false)
				}
				ad.onAdDismissed = () => {
					finish(true)
				}
				try {
					ad.show()
					// Safety timeout if callbacks never fire.
					setTimeout(() => finish(true), 30_000)
				} catch {
					finish(false)
				}
			})
		},
	}
}
