/**
 * Duplicate analysis — existing library + within-file (indexed, O(n)).
 */

import { SqlExecutor } from '@/db/sqlExecutor'
import { normalizeIsbn, normalizeText } from '@/domain/libraryValidation'
import type { DuplicatePolicy, ImportBookCandidate } from './types'
import { shelfKey } from './normalize'

interface ExistingIndexEntry {
	bookId: string
	entryId: string
	title: string
	authorText: string
	isbn10: string | null
	isbn13: string | null
}

export interface ExistingLibraryIndex {
	byIsbn: Map<string, ExistingIndexEntry>
	byTitleAuthor: Map<string, ExistingIndexEntry>
}

function titleAuthorKey (title: string, author: string): string {
	return `${normalizeText(title)}::${normalizeText(author)}`
}

/**
 * Build lookup indexes for active (non-archived) library books.
 */
export async function buildExistingLibraryIndex (
	db: SqlExecutor,
): Promise<ExistingLibraryIndex> {
	const rows = await db.getAllAsync<{
		book_id: string
		entry_id: string
		title: string
		author_text: string
		isbn10: string | null
		isbn13: string | null
	}>(
		`SELECT b.id AS book_id, e.id AS entry_id, b.title, b.author_text,
						b.isbn10, b.isbn13
		 FROM library_entries e
		 JOIN books b ON b.id = e.book_id
		 WHERE e.archived_at IS NULL AND b.archived_at IS NULL`,
	)

	const byIsbn = new Map<string, ExistingIndexEntry>()
	const byTitleAuthor = new Map<string, ExistingIndexEntry>()

	for (const row of rows) {
		const entry: ExistingIndexEntry = {
			bookId: row.book_id,
			entryId: row.entry_id,
			title: row.title,
			authorText: row.author_text,
			isbn10: row.isbn10,
			isbn13: row.isbn13,
		}
		if (row.isbn13) {
			byIsbn.set(normalizeIsbn(row.isbn13), entry)
		}
		if (row.isbn10) {
			byIsbn.set(normalizeIsbn(row.isbn10), entry)
		}
		byTitleAuthor.set(
			titleAuthorKey(row.title, row.author_text ?? ''),
			entry,
		)
	}

	return { byIsbn, byTitleAuthor }
}

function findExisting (
	index: ExistingLibraryIndex,
	candidate: ImportBookCandidate,
): ExistingIndexEntry | null {
	if (candidate.isbn13) {
		const hit = index.byIsbn.get(normalizeIsbn(candidate.isbn13))
		if (hit) {
			return hit
		}
	}
	if (candidate.isbn10) {
		const hit = index.byIsbn.get(normalizeIsbn(candidate.isbn10))
		if (hit) {
			return hit
		}
	}
	const ta = index.byTitleAuthor.get(
		titleAuthorKey(candidate.title, candidate.authorText),
	)
	return ta ?? null
}

/**
 * Annotate candidates with duplicateKind / existing refs.
 * Within-file: first valid occurrence wins; later ones mark WITHIN_FILE.
 * Default policy SKIP; selected=false for within-file and existing when SKIP.
 */
export function analyzeDuplicates (
	candidates: ImportBookCandidate[],
	index: ExistingLibraryIndex,
	defaultPolicy: DuplicatePolicy = 'SKIP',
): ImportBookCandidate[] {
	const seenIsbn = new Map<string, string>()
	const seenTitleAuthor = new Map<string, string>()

	return candidates.map((raw) => {
		const c: ImportBookCandidate = {
			...raw,
			policy: defaultPolicy,
			duplicateKind: null,
			existingEntryId: null,
			existingBookId: null,
			existingTitle: null,
			withinFilePrimaryId: null,
		}

		if (!c.valid) {
			c.selected = false
			return c
		}

		const existing = findExisting(index, c)
		if (existing) {
			c.duplicateKind = 'EXISTING_LIBRARY'
			c.existingEntryId = existing.entryId
			c.existingBookId = existing.bookId
			c.existingTitle = existing.title
			c.selected = defaultPolicy === 'ADD_EDITION'
			c.policy = defaultPolicy
			return c
		}

		const isbnKeys = [c.isbn13, c.isbn10]
			.filter(Boolean)
			.map((v) => normalizeIsbn(v!))
		for (const key of isbnKeys) {
			const primary = seenIsbn.get(key)
			if (primary) {
				c.duplicateKind = 'WITHIN_FILE'
				c.withinFilePrimaryId = primary
				c.selected = false
				c.policy = 'SKIP'
				return c
			}
		}

		const ta = titleAuthorKey(c.title, c.authorText)
		const primaryTa = seenTitleAuthor.get(ta)
		if (primaryTa) {
			c.duplicateKind = 'WITHIN_FILE'
			c.withinFilePrimaryId = primaryTa
			c.selected = false
			c.policy = 'SKIP'
			return c
		}

		// Register as first occurrence
		for (const key of isbnKeys) {
			seenIsbn.set(key, c.id)
		}
		seenTitleAuthor.set(ta, c.id)
		c.selected = true
		return c
	})
}

/**
 * Apply global policy to EXISTING_LIBRARY duplicates (not within-file).
 */
export function applyDuplicatePolicy (
	candidates: ImportBookCandidate[],
	policy: DuplicatePolicy,
): ImportBookCandidate[] {
	return candidates.map((c) => {
		if (!c.valid) {
			return { ...c, selected: false, policy }
		}
		if (c.duplicateKind === 'WITHIN_FILE') {
			return { ...c, selected: false, policy: 'SKIP' }
		}
		if (c.duplicateKind === 'EXISTING_LIBRARY') {
			return {
				...c,
				policy,
				selected: policy === 'ADD_EDITION',
			}
		}
		return { ...c, policy, selected: true }
	})
}

export { shelfKey, titleAuthorKey }
