/**
 * Pure interstitial eligibility policy — unit-testable without Yandex SDK.
 * Whitelist-only safe contexts; once-per-session; delayed + action gates.
 */

import {
	ADS_INTERSTITIAL_FAILURE_COOLDOWN_MS,
	ADS_INTERSTITIAL_MIN_ACTIONS,
	ADS_INTERSTITIAL_MIN_ELAPSED_MS,
} from '@/config/ads'
import { AdContexts, type AdContext } from './adContexts'

/** Contexts where interstitial may be considered after gates pass. */
export const INTERSTITIAL_WHITELIST: ReadonlySet<AdContext> = new Set([
	AdContexts.LIBRARY,
	AdContexts.DIARY,
	AdContexts.STATISTICS,
	AdContexts.MORE,
])

export interface InterstitialSessionState {
	appStartedAt: number
	meaningfulActionCount: number
	interstitialShown: boolean
	lastFailedAttemptAt: number | null
}

export interface InterstitialEligibilityInput {
	state: InterstitialSessionState
	context: AdContext
	now: number
	adReady: boolean
}

export type InterstitialDenyReason =
	| 'already_shown'
	| 'too_early'
	| 'insufficient_actions'
	| 'forbidden_context'
	| 'ad_not_ready'
	| 'failure_cooldown'

export interface InterstitialEligibilityResult {
	eligible: boolean
	reason?: InterstitialDenyReason
}

/**
 * Creates fresh in-memory session state (not persisted).
 */
export function createInterstitialSessionState (
	now: number = Date.now(),
): InterstitialSessionState {
	return {
		appStartedAt: now,
		meaningfulActionCount: 0,
		interstitialShown: false,
		lastFailedAttemptAt: null,
	}
}

export function recordMeaningfulAction (
	state: InterstitialSessionState,
): InterstitialSessionState {
	return {
		...state,
		meaningfulActionCount: state.meaningfulActionCount + 1,
	}
}

export function markInterstitialShown (
	state: InterstitialSessionState,
): InterstitialSessionState {
	return {
		...state,
		interstitialShown: true,
	}
}

export function markInterstitialAttemptFailed (
	state: InterstitialSessionState,
	now: number = Date.now(),
): InterstitialSessionState {
	return {
		...state,
		lastFailedAttemptAt: now,
	}
}

/**
 * Pure eligibility check for interstitial show.
 */
export function canShowInterstitial (
	input: InterstitialEligibilityInput,
): InterstitialEligibilityResult {
	const { state, context, now, adReady } = input

	if (state.interstitialShown) {
		return { eligible: false, reason: 'already_shown' }
	}

	if (!INTERSTITIAL_WHITELIST.has(context)) {
		return { eligible: false, reason: 'forbidden_context' }
	}

	const elapsed = now - state.appStartedAt
	if (elapsed < ADS_INTERSTITIAL_MIN_ELAPSED_MS) {
		return { eligible: false, reason: 'too_early' }
	}

	if (state.meaningfulActionCount < ADS_INTERSTITIAL_MIN_ACTIONS) {
		return { eligible: false, reason: 'insufficient_actions' }
	}

	if (
		state.lastFailedAttemptAt != null
		&& now - state.lastFailedAttemptAt < ADS_INTERSTITIAL_FAILURE_COOLDOWN_MS
	) {
		return { eligible: false, reason: 'failure_cooldown' }
	}

	if (!adReady) {
		return { eligible: false, reason: 'ad_not_ready' }
	}

	return { eligible: true }
}

/**
 * Explicit forbidden contexts (documentation / regression helpers).
 * Whitelist remains the source of truth for eligibility.
 */
export function isInterstitialHardForbidden (context: AdContext): boolean {
	return !INTERSTITIAL_WHITELIST.has(context)
}
