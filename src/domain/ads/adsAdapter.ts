/**
 * Ads adapter interface — Yandex native vs memory test double.
 */

export interface AdsAdapter {
	initialize (): Promise<void>
	preloadInterstitial (): Promise<void>
	isInterstitialReady (): boolean
	/**
	 * Shows interstitial if loaded.
	 * Resolves when dismissed or failed; never throws to adsService callers.
	 */
	showInterstitial (): Promise<{ shown: boolean }>
}

/**
 * In-memory ads adapter for Jest — controllable readiness / show results.
 */
export function createMemoryAdsAdapter (options?: {
	ready?: boolean
	showSucceeds?: boolean
}): AdsAdapter & {
	initCount: number
	preloadCount: number
	showCount: number
	setReady (ready: boolean): void
	setShowSucceeds (ok: boolean): void
	reset (): void
} {
	let ready = options?.ready ?? false
	let showSucceeds = options?.showSucceeds ?? true
	let initCount = 0
	let preloadCount = 0
	let showCount = 0

	return {
		get initCount () {
			return initCount
		},
		get preloadCount () {
			return preloadCount
		},
		get showCount () {
			return showCount
		},
		setReady (next: boolean) {
			ready = next
		},
		setShowSucceeds (ok: boolean) {
			showSucceeds = ok
		},
		reset () {
			ready = options?.ready ?? false
			showSucceeds = options?.showSucceeds ?? true
			initCount = 0
			preloadCount = 0
			showCount = 0
		},
		async initialize () {
			initCount += 1
		},
		async preloadInterstitial () {
			preloadCount += 1
			ready = true
		},
		isInterstitialReady () {
			return ready
		},
		async showInterstitial () {
			showCount += 1
			if (!ready || !showSucceeds) {
				return { shown: false }
			}
			ready = false
			return { shown: true }
		},
	}
}
