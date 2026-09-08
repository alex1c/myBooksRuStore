/**
 * Central Yandex Mobile Ads configuration.
 * Production placement IDs stay here — screens never hardcode R-M-… strings.
 */

/** Banner group used by Today + Library. */
export const ADS_BANNER_GROUP_TODAY_LIBRARY = 'today_library' as const
/** Banner group used by Diary + Statistics. */
export const ADS_BANNER_GROUP_DIARY_STATS = 'diary_stats' as const
/** Banner group used by More (secondary hub). */
export const ADS_BANNER_GROUP_MORE = 'more' as const

export type AdBannerGroup =
	| typeof ADS_BANNER_GROUP_TODAY_LIBRARY
	| typeof ADS_BANNER_GROUP_DIARY_STATS
	| typeof ADS_BANNER_GROUP_MORE

/** Production banner placements (РСЯ). */
export const ADS_PRODUCTION_BANNER_IDS: Record<AdBannerGroup, string> = {
	[ADS_BANNER_GROUP_TODAY_LIBRARY]: 'R-M-20004307-1',
	[ADS_BANNER_GROUP_DIARY_STATS]: 'R-M-20004307-2',
	[ADS_BANNER_GROUP_MORE]: 'R-M-20004307-3',
}

/** Production interstitial placement. */
export const ADS_PRODUCTION_INTERSTITIAL_ID = 'R-M-20004307-4'

/**
 * Official Yandex demo / test unit IDs.
 * Used in __DEV__ so development does not generate real impressions/clicks.
 * @see https://ads.yandex.com/helpcenter/en/dev/android/demo-blocks
 */
export const ADS_TEST_BANNER_ID = 'demo-banner-yandex'
export const ADS_TEST_INTERSTITIAL_ID = 'demo-interstitial-yandex'

/** Minimum time after cold start before interstitial may show. */
export const ADS_INTERSTITIAL_MIN_ELAPSED_MS = 3 * 60 * 1000

/** Minimum meaningful actions before interstitial may show. */
export const ADS_INTERSTITIAL_MIN_ACTIONS = 4

/**
 * Cooldown after a failed / not-ready interstitial attempt.
 * Prevents spamming the SDK on every navigation.
 */
export const ADS_INTERSTITIAL_FAILURE_COOLDOWN_MS = 60 * 1000

/** Reserved sticky banner height (density-independent px). */
export const ADS_BANNER_RESERVED_HEIGHT = 50

/** Extra spacing between primary CTAs and banner. */
export const ADS_BANNER_TOP_SPACING = 12

/**
 * Resolve the ad unit ID for a banner group.
 * Development uses official demo units; release uses production IDs.
 */
export function resolveBannerAdUnitId (group: AdBannerGroup): string {
	if (typeof __DEV__ !== 'undefined' && __DEV__) {
		return ADS_TEST_BANNER_ID
	}
	return ADS_PRODUCTION_BANNER_IDS[group]
}

/**
 * Resolve interstitial ad unit ID for the current build mode.
 */
export function resolveInterstitialAdUnitId (): string {
	if (typeof __DEV__ !== 'undefined' && __DEV__) {
		return ADS_TEST_INTERSTITIAL_ID
	}
	return ADS_PRODUCTION_INTERSTITIAL_ID
}

/**
 * Whether the current JS runtime should treat ads as production.
 * Useful for tests that assert release wiring without flipping __DEV__.
 */
export function getProductionBannerId (group: AdBannerGroup): string {
	return ADS_PRODUCTION_BANNER_IDS[group]
}

export function getProductionInterstitialId (): string {
	return ADS_PRODUCTION_INTERSTITIAL_ID
}
