/**
 * Holds a pending catalogue candidate between search → preview screens
 * without stuffing large JSON into route params.
 */

import type { NormalizedBookCandidate } from '@/services/bookSearch'

let pendingCandidate: NormalizedBookCandidate | null = null

export function setPendingSearchCandidate (
	candidate: NormalizedBookCandidate | null,
): void {
	pendingCandidate = candidate
}

export function getPendingSearchCandidate (): NormalizedBookCandidate | null {
	return pendingCandidate
}

export function consumePendingSearchCandidate (): NormalizedBookCandidate | null {
	const value = pendingCandidate
	pendingCandidate = null
	return value
}
