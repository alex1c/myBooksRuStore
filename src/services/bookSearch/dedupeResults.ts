/**
 * Collapse near-duplicate editions from catalogue search results.
 */

import { normalizeText } from '@/domain/libraryValidation'
import type { NormalizedBookCandidate } from './types'

function dedupeKey (item: NormalizedBookCandidate): string {
	if (item.isbn13) {
		return `isbn13:${item.isbn13}`
	}
	if (item.isbn10) {
		return `isbn10:${item.isbn10}`
	}
	return `ta:${normalizeText(item.title)}|${normalizeText(item.authorText)}`
}

/**
 * Keep the highest-quality candidate per ISBN / title+author group.
 */
export function dedupeSearchResults (
	items: NormalizedBookCandidate[],
	limit = 20,
): NormalizedBookCandidate[] {
	const best = new Map<string, NormalizedBookCandidate>()
	for (const item of items) {
		const key = dedupeKey(item)
		const existing = best.get(key)
		if (!existing || item.qualityScore > existing.qualityScore) {
			best.set(key, item)
		}
	}
	return Array.from(best.values())
		.sort((a, b) => b.qualityScore - a.qualityScore)
		.slice(0, limit)
}
