/**
 * Central ads service — policy + adapter orchestration.
 * Navigation must never wait on ad load; show is best-effort at safe transitions.
 */

import { AnalyticsEvents } from '@/domain/analytics/types'
import { track } from '@/domain/analytics/analyticsService'
import { logger } from '@/services/logging'
import type { AdsAdapter } from './adsAdapter'
import { createMemoryAdsAdapter } from './adsAdapter'
import { createYandexAdsAdapter } from './yandexAdsAdapter'
import type { AdContext } from './adContexts'
import {
	canShowInterstitial,
	createInterstitialSessionState,
	markInterstitialAttemptFailed,
	markInterstitialShown,
	recordMeaningfulAction as bumpAction,
	type InterstitialSessionState,
} from './interstitialPolicy'
import {
	isBannerAllowed,
	resolveBannerPlacement,
	type BannerPolicyInput,
} from './bannerPolicy'

let adapter: AdsAdapter | null = null
let session: InterstitialSessionState = createInterstitialSessionState()
let initialized = false
let showing = false

function isJestRuntime (): boolean {
	return typeof process !== 'undefined' && !!process.env.JEST_WORKER_ID
}

function getAdapter (): AdsAdapter {
	if (!adapter) {
		adapter = isJestRuntime()
			? createMemoryAdsAdapter()
			: createYandexAdsAdapter()
	}
	return adapter
}

export function setAdsAdapter (next: AdsAdapter | null): void {
	adapter = next
	initialized = false
}

export function resetAdsSession (now: number = Date.now()): void {
	session = createInterstitialSessionState(now)
	showing = false
}

export function getAdsSessionState (): InterstitialSessionState {
	return { ...session }
}

/**
 * Secondary init after local bootstrap — never blocks UI.
 */
export function initializeAds (): void {
	if (initialized) {
		return
	}
	initialized = true
	session = createInterstitialSessionState()
	void (async () => {
		try {
			await getAdapter().initialize()
			// Preload once; do not auto-show.
			await getAdapter().preloadInterstitial()
		} catch (error) {
			logger.warn('Ads initialize/preload failed', { error })
		}
	})()
}

export function recordMeaningfulAdAction (): void {
	session = bumpAction(session)
}

export function getBannerPlacement (input: BannerPolicyInput) {
	return resolveBannerPlacement(input)
}

export function shouldShowBanner (input: BannerPolicyInput): boolean {
	return isBannerAllowed(input)
}

/**
 * Attempt interstitial at a natural transition.
 * Always resolves quickly; returns whether an ad was shown.
 * Caller continues navigation regardless.
 */
export async function tryShowInterstitial (
	context: AdContext,
	now: number = Date.now(),
): Promise<{ shown: boolean }> {
	if (showing) {
		return { shown: false }
	}

	const ready = getAdapter().isInterstitialReady()
	const decision = canShowInterstitial({
		state: session,
		context,
		now,
		adReady: ready,
	})

	if (!decision.eligible) {
		if (decision.reason === 'ad_not_ready') {
			session = markInterstitialAttemptFailed(session, now)
			// Best-effort reload for a later transition.
			void getAdapter().preloadInterstitial().catch(() => undefined)
		}
		return { shown: false }
	}

	showing = true
	try {
		const result = await getAdapter().showInterstitial()
		if (result.shown) {
			session = markInterstitialShown(session)
			track(AnalyticsEvents.interstitialShown)
			// Max 1/session — do not preload another.
		} else {
			session = markInterstitialAttemptFailed(session, now)
			void getAdapter().preloadInterstitial().catch(() => undefined)
		}
		return result
	} catch (error) {
		logger.warn('Interstitial show failed', { error })
		session = markInterstitialAttemptFailed(session, now)
		return { shown: false }
	} finally {
		showing = false
	}
}

/**
 * Navigation helper: record action, optionally try interstitial, never block.
 */
export function onSafeTabTransition (context: AdContext): void {
	recordMeaningfulAdAction()
	void tryShowInterstitial(context)
}

export { createMemoryAdsAdapter }
