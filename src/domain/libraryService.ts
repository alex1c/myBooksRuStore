/**
 * Library service — UI-facing orchestration over books + library_entries + shelves.
 * Keeps multi-table writes transactional and SQL out of screens.
 */

import type {
	BookFormat,
	FinishedDatePrecision,
	LibrarySort,
	LibraryStatus,
	ProgressMode,
} from '@/constants/domain'
import { defaultProgressModeForFormat } from '@/constants/domain'
import {
	createBook,
	findSimilarBooks,
	getBookById,
	mapBook,
	updateBook,
	type BookRow,
	type CreateBookInput,
	type UpdateBookInput,
} from '@/db/repositories/books'
import {
	archiveLibraryEntry,
	createLibraryEntry,
	getLibraryEntryById,
	mapLibraryEntry,
	restoreLibraryEntry,
	updateLibraryEntry,
	type CreateLibraryEntryInput,
	type LibraryEntryRow,
	type UpdateLibraryEntryInput,
} from '@/db/repositories/libraryEntries'
import {
	listActiveShelves,
	listShelfIdsForEntry,
	setEntryShelves,
} from '@/db/repositories/shelves'
import { SqlExecutor } from '@/db/sqlExecutor'
import {
	LibraryBookItem,
	LibraryStatusCounts,
	Shelf,
} from '@/db/types'
import { normalizeText } from '@/domain/libraryValidation'
import { toDateOnlyLocal } from '@/utils/dates'

export type LibraryStatusFilter = LibraryStatus | 'ALL'

export interface LibraryQuery {
	search?: string
	status?: LibraryStatusFilter
	shelfId?: string | null
	sort?: LibrarySort
	archived?: boolean
}

export interface AddLibraryBookInput {
	book: CreateBookInput
	entry: Omit<CreateLibraryEntryInput, 'bookId'>
	shelfIds?: string[]
	/** Skip duplicate warning and force insert. */
	forceAdd?: boolean
}

export interface UpdateLibraryBookInput {
	entryId: string
	book?: UpdateBookInput
	entry?: UpdateLibraryEntryInput
	shelfIds?: string[]
}

export interface DuplicateCheckResult {
	hasDuplicates: boolean
	matches: LibraryBookItem[]
}

type JoinedRow = BookRow &
	LibraryEntryRow & {
		// book id overlaps with entry id naming — use aliases in SQL
		book_id_pk: string
		entry_id: string
		book_created_at: string
		book_updated_at: string
		book_archived_at: string | null
		entry_created_at: string
		entry_updated_at: string
		entry_archived_at: string | null
	}

function mapJoined (row: JoinedRow, shelfIds: string[]): LibraryBookItem {
	const book = mapBook({
		id: row.book_id_pk,
		title: row.title,
		subtitle: row.subtitle,
		author_text: row.author_text,
		description: row.description,
		isbn10: row.isbn10,
		isbn13: row.isbn13,
		publisher: row.publisher,
		published_year: row.published_year,
		language: row.language,
		page_count: row.page_count,
		cover_uri: row.cover_uri,
		source: row.source,
		source_external_id: row.source_external_id,
		created_at: row.book_created_at,
		updated_at: row.book_updated_at,
		archived_at: row.book_archived_at,
	})
	const entry = mapLibraryEntry({
		id: row.entry_id,
		book_id: row.book_id,
		status: row.status,
		format: row.format,
		progress_mode: row.progress_mode,
		current_page: row.current_page,
		total_pages: row.total_pages,
		current_percent: row.current_percent,
		audio_position_seconds: row.audio_position_seconds,
		audio_duration_seconds: row.audio_duration_seconds,
		started_at: row.started_at,
		finished_at: row.finished_at,
		finished_date_precision: row.finished_date_precision,
		finished_year: row.finished_year,
		finished_on: row.finished_on,
		rating: row.rating,
		review_text: row.review_text,
		created_at: row.entry_created_at,
		updated_at: row.entry_updated_at,
		archived_at: row.entry_archived_at,
	})
	return { book, entry, shelfIds }
}

const JOIN_SELECT = `
	SELECT
		b.id AS book_id_pk,
		b.title,
		b.subtitle,
		b.author_text,
		b.description,
		b.isbn10,
		b.isbn13,
		b.publisher,
		b.published_year,
		b.language,
		b.page_count,
		b.cover_uri,
		b.source,
		b.source_external_id,
		b.created_at AS book_created_at,
		b.updated_at AS book_updated_at,
		b.archived_at AS book_archived_at,
		e.id AS entry_id,
		e.book_id,
		e.status,
		e.format,
		e.progress_mode,
		e.current_page,
		e.total_pages,
		e.current_percent,
		e.audio_position_seconds,
		e.audio_duration_seconds,
		e.started_at,
		e.finished_at,
		e.finished_date_precision,
		e.finished_year,
		e.finished_on,
		e.rating,
		e.review_text,
		e.created_at AS entry_created_at,
		e.updated_at AS entry_updated_at,
		e.archived_at AS entry_archived_at
	FROM library_entries e
	INNER JOIN books b ON b.id = e.book_id
`

async function loadShelfMap (
	db: SqlExecutor,
	entryIds: string[],
): Promise<Map<string, string[]>> {
	const map = new Map<string, string[]>()
	if (entryIds.length === 0) {
		return map
	}
	for (const entryId of entryIds) {
		map.set(entryId, await listShelfIdsForEntry(db, entryId))
	}
	return map
}

function matchesSearch (item: LibraryBookItem, rawSearch: string): boolean {
	const q = normalizeText(rawSearch)
	if (!q) {
		return true
	}
	const haystack = normalizeText(
		[
			item.book.title,
			item.book.subtitle ?? '',
			item.book.authorText,
		].join(' '),
	)
	return haystack.includes(q)
}

function compareLibraryItems (
	a: LibraryBookItem,
	b: LibraryBookItem,
	sort: LibrarySort,
): number {
	switch (sort) {
		case 'TITLE':
			return a.book.title.localeCompare(b.book.title, 'ru', {
				sensitivity: 'base',
			})
		case 'AUTHOR': {
			const authorCmp = a.book.authorText.localeCompare(
				b.book.authorText,
				'ru',
				{ sensitivity: 'base' },
			)
			if (authorCmp !== 0) {
				return authorCmp
			}
			return a.book.title.localeCompare(b.book.title, 'ru', {
				sensitivity: 'base',
			})
		}
		case 'FINISHED_DATE': {
			const score = (item: LibraryBookItem): string => {
				const e = item.entry
				if (e.finishedDatePrecision === 'EXACT' && e.finishedOn) {
					return `2:${e.finishedOn}`
				}
				if (e.finishedDatePrecision === 'YEAR' && e.finishedYear != null) {
					return `1:${String(e.finishedYear).padStart(4, '0')}`
				}
				return '0:'
			}
			const cmp = score(b).localeCompare(score(a))
			if (cmp !== 0) {
				return cmp
			}
			return b.entry.updatedAt.localeCompare(a.entry.updatedAt)
		}
		case 'RECENTLY_ADDED':
			return b.entry.createdAt.localeCompare(a.entry.createdAt)
		case 'RECENTLY_UPDATED':
		default:
			return b.entry.updatedAt.localeCompare(a.entry.updatedAt)
	}
}

/**
 * Lists library books with local search / status / shelf / sort.
 * Filtering is done in-memory after a single join query — fine for 1000+ books.
 */
export async function listLibraryBooks (
	db: SqlExecutor,
	query: LibraryQuery = {},
): Promise<LibraryBookItem[]> {
	const archived = query.archived === true
	const rows = await db.getAllAsync<JoinedRow>(
		`${JOIN_SELECT}
		 WHERE ${archived ? 'e.archived_at IS NOT NULL' : 'e.archived_at IS NULL'}`,
	)

	const shelfMap = await loadShelfMap(
		db,
		rows.map((row) => row.entry_id),
	)
	let items = rows.map((row) =>
		mapJoined(row, shelfMap.get(row.entry_id) ?? []),
	)

	if (query.status && query.status !== 'ALL') {
		items = items.filter((item) => item.entry.status === query.status)
	}
	if (query.shelfId) {
		items = items.filter((item) => item.shelfIds.includes(query.shelfId!))
	}
	if (query.search?.trim()) {
		items = items.filter((item) => matchesSearch(item, query.search!))
	}

	const sort = query.sort ?? 'RECENTLY_UPDATED'
	items.sort((a, b) => compareLibraryItems(a, b, sort))
	return items
}

export async function getLibraryBookByEntryId (
	db: SqlExecutor,
	entryId: string,
): Promise<LibraryBookItem | null> {
	const row = await db.getFirstAsync<JoinedRow>(
		`${JOIN_SELECT} WHERE e.id = ?`,
		[entryId],
	)
	if (!row) {
		return null
	}
	const shelfIds = await listShelfIdsForEntry(db, entryId)
	return mapJoined(row, shelfIds)
}

export async function getLibraryStatusCounts (
	db: SqlExecutor,
): Promise<LibraryStatusCounts> {
	const rows = await db.getAllAsync<{ status: string; count: number }>(
		`SELECT status, COUNT(*) AS count
		 FROM library_entries
		 WHERE archived_at IS NULL
		 GROUP BY status`,
	)
	const counts: LibraryStatusCounts = {
		all: 0,
		WANT_TO_READ: 0,
		READING: 0,
		FINISHED: 0,
		PAUSED: 0,
		ABANDONED: 0,
	}
	for (const row of rows) {
		const key = row.status as LibraryStatus
		if (key in counts) {
			counts[key] = row.count
			counts.all += row.count
		}
	}
	return counts
}

export async function listReadingNow (
	db: SqlExecutor,
): Promise<LibraryBookItem[]> {
	return listLibraryBooks(db, {
		status: 'READING',
		sort: 'RECENTLY_UPDATED',
	})
}

/**
 * Basic duplicate detection by normalized title+author and/or ISBN.
 */
export async function findLibraryDuplicates (
	db: SqlExecutor,
	input: {
		title: string
		authorText?: string | null
		isbn10?: string | null
		isbn13?: string | null
		excludeBookId?: string
	},
): Promise<DuplicateCheckResult> {
	const similarBooks = await findSimilarBooks(db, input)
	const matches: LibraryBookItem[] = []
	for (const book of similarBooks) {
		const entryRow = await db.getFirstAsync<LibraryEntryRow>(
			`SELECT * FROM library_entries
			 WHERE book_id = ? AND archived_at IS NULL
			 ORDER BY updated_at DESC LIMIT 1`,
			[book.id],
		)
		if (!entryRow) {
			continue
		}
		const entry = mapLibraryEntry(entryRow)
		const shelfIds = await listShelfIdsForEntry(db, entry.id)
		matches.push({ book, entry, shelfIds })
	}
	return { hasDuplicates: matches.length > 0, matches }
}

async function runInTransaction<T> (
	db: SqlExecutor,
	task: () => Promise<T>,
): Promise<T> {
	if (db.withTransactionAsync) {
		return db.withTransactionAsync(task)
	}
	return task()
}

/**
 * Atomically create book + library entry + shelf links.
 */
export async function addBookToLibrary (
	db: SqlExecutor,
	input: AddLibraryBookInput,
): Promise<LibraryBookItem> {
	return runInTransaction(db, async () => {
		const book = await createBook(db, input.book)
		const entry = await createLibraryEntry(db, {
			...input.entry,
			bookId: book.id,
		})
		if (input.shelfIds && input.shelfIds.length > 0) {
			await setEntryShelves(db, entry.id, input.shelfIds)
		}
		const shelfIds = await listShelfIdsForEntry(db, entry.id)
		return { book, entry, shelfIds }
	})
}

/**
 * Atomically update book metadata, library entry, and shelf links.
 */
export async function updateLibraryBook (
	db: SqlExecutor,
	input: UpdateLibraryBookInput,
): Promise<LibraryBookItem> {
	return runInTransaction(db, async () => {
		const existing = await getLibraryEntryById(db, input.entryId)
		if (!existing) {
			throw new Error('LIBRARY_ENTRY_NOT_FOUND')
		}
		if (input.book) {
			await updateBook(db, existing.bookId, input.book)
		}
		const entry = input.entry
			? await updateLibraryEntry(db, input.entryId, input.entry)
			: existing
		if (input.shelfIds) {
			await setEntryShelves(db, input.entryId, input.shelfIds)
		}
		const book = await getBookById(db, entry.bookId)
		if (!book) {
			throw new Error('BOOK_NOT_FOUND')
		}
		const shelfIds = await listShelfIdsForEntry(db, entry.id)
		return { book, entry, shelfIds }
	})
}

export async function archiveLibraryBook (
	db: SqlExecutor,
	entryId: string,
): Promise<void> {
	await archiveLibraryEntry(db, entryId)
}

export async function restoreLibraryBook (
	db: SqlExecutor,
	entryId: string,
): Promise<void> {
	await restoreLibraryEntry(db, entryId)
}

export async function listShelves (db: SqlExecutor): Promise<Shelf[]> {
	return listActiveShelves(db)
}

/** Build finished-date payload helpers for forms. */
export function finishedTodayPayload (): {
	finishedDatePrecision: FinishedDatePrecision
	finishedOn: string
	finishedYear: null
} {
	return {
		finishedDatePrecision: 'EXACT',
		finishedOn: toDateOnlyLocal(),
		finishedYear: null,
	}
}

export function finishedExactPayload (dateOnly: string): {
	finishedDatePrecision: FinishedDatePrecision
	finishedOn: string
	finishedYear: null
} {
	return {
		finishedDatePrecision: 'EXACT',
		finishedOn: dateOnly,
		finishedYear: null,
	}
}

export function finishedYearPayload (year: number): {
	finishedDatePrecision: FinishedDatePrecision
	finishedOn: null
	finishedYear: number
} {
	return {
		finishedDatePrecision: 'YEAR',
		finishedOn: null,
		finishedYear: year,
	}
}

export function finishedUnknownPayload (): {
	finishedDatePrecision: FinishedDatePrecision
	finishedOn: null
	finishedYear: null
} {
	return {
		finishedDatePrecision: 'UNKNOWN',
		finishedOn: null,
		finishedYear: null,
	}
}

/**
 * Suggest progress completion when marking FINISHED.
 * Returns proposed fields without forcing overwrite in the service —
 * the form applies them when the user switches status.
 */
export function suggestFinishedProgress (input: {
	progressMode: ProgressMode
	currentPage: number | null
	totalPages: number | null
	currentPercent: number | null
	audioPositionSeconds: number | null
	audioDurationSeconds: number | null
	bookPageCount: number | null
}): Partial<{
	currentPage: number | null
	totalPages: number | null
	currentPercent: number | null
	audioPositionSeconds: number | null
}> {
	if (input.progressMode === 'PAGES') {
		const total = input.totalPages ?? input.bookPageCount
		if (total != null && total > 0) {
			return { totalPages: total, currentPage: total }
		}
	}
	if (input.progressMode === 'PERCENT') {
		return { currentPercent: 100 }
	}
	if (
		input.progressMode === 'TIME' &&
		input.audioDurationSeconds != null &&
		input.audioDurationSeconds > 0
	) {
		return { audioPositionSeconds: input.audioDurationSeconds }
	}
	return {}
}

export function suggestProgressMode (format: BookFormat): ProgressMode {
	return defaultProgressModeForFormat(format)
}
