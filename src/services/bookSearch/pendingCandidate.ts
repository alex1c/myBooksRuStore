/**
 * Holds a pending catalogue candidate between search → preview screens
 * without stuffing large JSON into route params.
 */

import type { BookAddSource } from '@/domain/analytics/types'
import type { NormalizedBookCandidate } from '@/services/bookSearch'

let pendingCandidate: NormalizedBookCandidate | null = null
/** Analytics-only source for the pending add (search vs ISBN). */
let pendingAddSource: Extract<BookAddSource, 'search' | 'isbn'> = 'search'

export function setPendingSearchCandidate (
	candidate: NormalizedBookCandidate | null,
	addSource: Extract<BookAddSource, 'search' | 'isbn'> = 'search',
): void {
	pendingCandidate = candidate
	pendingAddSource = addSource
}

export function getPendingSearchCandidate (): NormalizedBookCandidate | null {
	return pendingCandidate
}

export function getPendingBookAddSource (): Extract<
	BookAddSource,
	'search' | 'isbn'
> {
	return pendingAddSource
}

export function consumePendingSearchCandidate (): NormalizedBookCandidate | null {
	const value = pendingCandidate
	pendingCandidate = null
	return value
}
