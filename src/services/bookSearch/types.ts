/**
 * Provider-agnostic book search types.
 * External catalogue is metadata-only — never a local primary key source.
 */

export interface NormalizedBookCandidate {
	/** Stable opaque id within this app session / provider result set. */
	resultId: string
	title: string
	subtitle: string | null
	authorText: string
	description: string | null
	isbn10: string | null
	isbn13: string | null
	publisher: string | null
	publishedYear: number | null
	pageCount: number | null
	language: string | null
	/** Remote cover URL suitable for download/display. */
	coverUrl: string | null
	source: string
	sourceExternalId: string
	/** Ranking hint — higher is better for UI ordering. */
	qualityScore: number
}

export interface BookSearchQuery {
	query: string
	signal?: AbortSignal
}

export interface BookSearchProvider {
	readonly id: string
	readonly displayName: string
	search (input: BookSearchQuery): Promise<NormalizedBookCandidate[]>
	lookupByIsbn (
		isbn: string,
		signal?: AbortSignal,
	): Promise<NormalizedBookCandidate | null>
}
