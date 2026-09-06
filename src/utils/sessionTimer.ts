/**
 * Timer / elapsed helpers for reading sessions.
 * Source of truth is wall-clock timestamps — never trust interval counters alone.
 */

/** Elapsed whole seconds between startedAt ISO and `nowMs` (floored, >= 0). */
export function elapsedSecondsFromStart (
	startedAt: string,
	nowMs: number = Date.now(),
): number {
	const startMs = Date.parse(startedAt)
	if (!Number.isFinite(startMs)) {
		return 0
	}
	return Math.max(0, Math.floor((nowMs - startMs) / 1000))
}

/**
 * Duration between two ISO timestamps, never negative (clock skew / DST).
 */
export function durationSecondsBetween (
	startedAt: string,
	endedAt: string,
): number {
	const startMs = Date.parse(startedAt)
	const endMs = Date.parse(endedAt)
	if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
		return 0
	}
	return Math.max(0, Math.floor((endMs - startMs) / 1000))
}

/**
 * Timer display: `37:12` under one hour, `1:07:03` after.
 * No milliseconds.
 */
export function formatSessionTimer (totalSeconds: number): string {
	const safe = Math.max(0, Math.floor(totalSeconds))
	const hours = Math.floor(safe / 3600)
	const minutes = Math.floor((safe % 3600) / 60)
	const seconds = safe % 60
	const mm = String(minutes).padStart(2, '0')
	const ss = String(seconds).padStart(2, '0')
	if (hours > 0) {
		return `${hours}:${mm}:${ss}`
	}
	return `${mm}:${ss}`
}

/** Human-friendly short duration for history rows (`37 мин`, `1 ч 5 мин`). */
export function formatSessionDurationLabel (totalSeconds: number): string {
	const safe = Math.max(0, Math.floor(totalSeconds))
	const hours = Math.floor(safe / 3600)
	const minutes = Math.floor((safe % 3600) / 60)
	if (hours <= 0) {
		return `${minutes} мин`
	}
	if (minutes <= 0) {
		return `${hours} ч`
	}
	return `${hours} ч ${minutes} мин`
}

/** Warn when an active session has been open longer than this (seconds). */
export const LONG_SESSION_WARNING_SECONDS = 12 * 60 * 60
