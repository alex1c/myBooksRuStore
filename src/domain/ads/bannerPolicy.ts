/**
 * Pure banner eligibility policy (no native SDK).
 */

import type { AdBannerGroup } from '@/config/ads'
import {
	ADS_BANNER_GROUP_DIARY_STATS,
	ADS_BANNER_GROUP_MORE,
	ADS_BANNER_GROUP_TODAY_LIBRARY,
} from '@/config/ads'
import { AdContexts, type AdContext } from './adContexts'

export interface BannerPolicyInput {
	context: AdContext
	/** When true on Today (HOME), hide banner during an active reading session. */
	hasActiveReadingSession?: boolean
}

export interface BannerPolicyResult {
	allowed: boolean
	group: AdBannerGroup | null
}

/**
 * Maps a screen context to a banner group, or denies the banner.
 */
export function resolveBannerPlacement (
	input: BannerPolicyInput,
): BannerPolicyResult {
	const { context, hasActiveReadingSession = false } = input

	if (context === AdContexts.HOME) {
		if (hasActiveReadingSession) {
			return { allowed: false, group: null }
		}
		return { allowed: true, group: ADS_BANNER_GROUP_TODAY_LIBRARY }
	}

	if (context === AdContexts.LIBRARY) {
		return { allowed: true, group: ADS_BANNER_GROUP_TODAY_LIBRARY }
	}

	if (context === AdContexts.DIARY || context === AdContexts.STATISTICS) {
		return { allowed: true, group: ADS_BANNER_GROUP_DIARY_STATS }
	}

	if (context === AdContexts.MORE) {
		return { allowed: true, group: ADS_BANNER_GROUP_MORE }
	}

	// Everything else: no banner (forms, OCR, help articles, onboarding, …).
	return { allowed: false, group: null }
}

export function isBannerAllowed (input: BannerPolicyInput): boolean {
	return resolveBannerPlacement(input).allowed
}
