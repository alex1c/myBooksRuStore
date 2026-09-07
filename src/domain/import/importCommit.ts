/**
 * Atomic import commit — books + entries + shelves only (no sessions/events).
 */

import {
	createBook,
	createLibraryEntry,
	createShelf,
	listActiveShelves,
	setEntryShelves,
} from '@/db/repositories'
import { SqlExecutor } from '@/db/sqlExecutor'
import type { ImportBookCandidate, ImportCommitReport } from './types'
import { shelfKey } from './normalize'

/**
 * Commit selected valid candidates in one transaction.
 * Never creates reading_sessions or reading_progress_events.
 */
export async function commitImportCandidates (
	db: SqlExecutor,
	candidates: ImportBookCandidate[],
): Promise<ImportCommitReport> {
	const selected = candidates.filter(
		(c) => c.selected && c.valid && c.duplicateKind !== 'WITHIN_FILE',
	)
	const skippedDuplicates = candidates.filter(
		(c) =>
			c.valid &&
			(c.duplicateKind === 'EXISTING_LIBRARY' ||
				c.duplicateKind === 'WITHIN_FILE') &&
			!c.selected,
	).length
	const errorRows = candidates.filter((c) => !c.valid).length

	if (!db.withTransactionAsync) {
		throw new Error('TRANSACTIONS_UNAVAILABLE')
	}

	let shelvesCreated = 0
	let added = 0

	await db.withTransactionAsync(async () => {
		const existingShelves = await listActiveShelves(db)
		const shelfByKey = new Map(
			existingShelves.map((s) => [shelfKey(s.name), s.id]),
		)

		const ensureShelf = async (name: string): Promise<string> => {
			const key = shelfKey(name)
			const hit = shelfByKey.get(key)
			if (hit) {
				return hit
			}
			const created = await createShelf(db, name)
			shelfByKey.set(key, created.id)
			shelvesCreated += 1
			return created.id
		}

		for (const c of selected) {
			if (c.duplicateKind === 'EXISTING_LIBRARY' && c.policy === 'SKIP') {
				continue
			}

			const book = await createBook(db, {
				title: c.title,
				authorText: c.authorText,
				isbn10: c.isbn10,
				isbn13: c.isbn13,
				publisher: c.publisher,
				publishedYear: c.publishedYear,
				pageCount: c.totalPages,
			})

			const entry = await createLibraryEntry(db, {
				bookId: book.id,
				status: c.status,
				format: c.format,
				progressMode: c.progressMode,
				currentPage: c.currentPage,
				totalPages: c.totalPages,
				currentPercent: c.currentPercent,
				audioPositionSeconds: c.audioPositionSeconds,
				audioDurationSeconds: c.audioDurationSeconds,
				startedAt: c.startedAt,
				// Never stamp "now" for historical EXACT finishes — use finishedOn noon UTC.
				finishedAt:
					c.finishedDatePrecision === 'EXACT' && c.finishedOn
						? `${c.finishedOn}T12:00:00.000Z`
						: null,
				finishedDatePrecision: c.finishedDatePrecision,
				finishedOn: c.finishedOn,
				finishedYear: c.finishedYear,
				rating: c.rating,
				reviewText: c.reviewText,
			})

			if (c.shelves.length > 0) {
				const ids: string[] = []
				for (const name of c.shelves) {
					ids.push(await ensureShelf(name))
				}
				await setEntryShelves(db, entry.id, [...new Set(ids)])
			}

			added += 1
		}
	})

	return {
		added,
		skippedDuplicates,
		errorRows,
		shelvesCreated,
	}
}
