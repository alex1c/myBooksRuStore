import {
	isBookFormat,
	isFinishedDatePrecision,
	isLibraryStatus,
	isProgressMode,
	type BookFormat,
	type FinishedDatePrecision,
	type LibraryStatus,
	type ProgressMode,
} from '@/constants/domain'
import { LibraryEntry } from '@/db/types'
import { SqlExecutor } from '@/db/sqlExecutor'
import { createId } from '@/utils/id'
import { nowIso } from '@/utils/dates'
import {
	validateFinishedDate,
	validateProgress,
	validateRating,
} from '@/domain/libraryValidation'

export interface LibraryEntryRow {
	id: string
	book_id: string
	status: string
	format: string
	progress_mode: string
	current_page: number | null
	total_pages: number | null
	current_percent: number | null
	audio_position_seconds: number | null
	audio_duration_seconds: number | null
	started_at: string | null
	finished_at: string | null
	finished_date_precision: string | null
	finished_year: number | null
	finished_on: string | null
	rating: number | null
	review_text: string | null
	created_at: string
	updated_at: string
	archived_at: string | null
}

export interface CreateLibraryEntryInput {
	bookId: string
	status?: LibraryStatus
	format?: BookFormat
	progressMode?: ProgressMode
	currentPage?: number | null
	totalPages?: number | null
	currentPercent?: number | null
	audioPositionSeconds?: number | null
	audioDurationSeconds?: number | null
	startedAt?: string | null
	finishedAt?: string | null
	finishedDatePrecision?: FinishedDatePrecision | null
	finishedYear?: number | null
	finishedOn?: string | null
	rating?: number | null
	reviewText?: string | null
}

export type UpdateLibraryEntryInput = Partial<
	Omit<CreateLibraryEntryInput, 'bookId'>
>

export function mapLibraryEntry (row: LibraryEntryRow): LibraryEntry {
	if (
		!isLibraryStatus(row.status) ||
		!isBookFormat(row.format) ||
		!isProgressMode(row.progress_mode)
	) {
		throw new Error('INVALID_LIBRARY_ENTRY_ENUM')
	}

	const precision = row.finished_date_precision
	if (precision != null && !isFinishedDatePrecision(precision)) {
		throw new Error('INVALID_FINISHED_DATE_PRECISION')
	}

	return {
		id: row.id,
		bookId: row.book_id,
		status: row.status,
		format: row.format,
		progressMode: row.progress_mode,
		currentPage: row.current_page,
		totalPages: row.total_pages,
		currentPercent: row.current_percent,
		audioPositionSeconds: row.audio_position_seconds,
		audioDurationSeconds: row.audio_duration_seconds,
		startedAt: row.started_at,
		finishedAt: row.finished_at,
		finishedDatePrecision: precision,
		finishedYear: row.finished_year,
		finishedOn: row.finished_on,
		rating: row.rating,
		reviewText: row.review_text,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		archivedAt: row.archived_at,
	}
}

function assertEntryPayload (input: {
	status: LibraryStatus
	format: BookFormat
	progressMode: ProgressMode
	currentPage?: number | null
	totalPages?: number | null
	currentPercent?: number | null
	audioPositionSeconds?: number | null
	audioDurationSeconds?: number | null
	finishedDatePrecision?: FinishedDatePrecision | null
	finishedYear?: number | null
	finishedOn?: string | null
	rating?: number | null
}) {
	if (!isLibraryStatus(input.status)) {
		throw new Error('INVALID_LIBRARY_STATUS')
	}
	if (!isBookFormat(input.format)) {
		throw new Error('INVALID_BOOK_FORMAT')
	}
	if (!isProgressMode(input.progressMode)) {
		throw new Error('INVALID_PROGRESS_MODE')
	}
	const progressError = validateProgress({
		progressMode: input.progressMode,
		currentPage: input.currentPage,
		totalPages: input.totalPages,
		currentPercent: input.currentPercent,
		audioPositionSeconds: input.audioPositionSeconds,
		audioDurationSeconds: input.audioDurationSeconds,
	})
	if (progressError) {
		throw new Error('INVALID_PROGRESS')
	}
	const ratingError = validateRating(input.rating)
	if (ratingError) {
		throw new Error('INVALID_RATING')
	}
	const finishedError = validateFinishedDate(input.status, {
		precision: input.finishedDatePrecision ?? null,
		finishedOn: input.finishedOn,
		finishedYear: input.finishedYear,
	})
	if (finishedError) {
		throw new Error('INVALID_FINISHED_DATE')
	}
}

/**
 * Normalize finished-date fields based on status + precision.
 * UNKNOWN / YEAR never invent a calendar day (especially not "today").
 */
export function resolveFinishedFields (input: {
	status: LibraryStatus
	finishedDatePrecision?: FinishedDatePrecision | null
	finishedYear?: number | null
	finishedOn?: string | null
	finishedAt?: string | null
}): {
	finishedAt: string | null
	finishedDatePrecision: FinishedDatePrecision | null
	finishedYear: number | null
	finishedOn: string | null
} {
	if (input.status !== 'FINISHED') {
		return {
			finishedAt: null,
			finishedDatePrecision: null,
			finishedYear: null,
			finishedOn: null,
		}
	}

	const precision = input.finishedDatePrecision ?? 'UNKNOWN'
	if (precision === 'EXACT') {
		return {
			finishedAt: input.finishedAt ?? nowIso(),
			finishedDatePrecision: 'EXACT',
			finishedYear: null,
			finishedOn: input.finishedOn ?? null,
		}
	}
	if (precision === 'YEAR') {
		return {
			finishedAt: null,
			finishedDatePrecision: 'YEAR',
			finishedYear: input.finishedYear ?? null,
			finishedOn: null,
		}
	}
	return {
		finishedAt: null,
		finishedDatePrecision: 'UNKNOWN',
		finishedYear: null,
		finishedOn: null,
	}
}

/**
 * Adds a book to the user library with default WANT_TO_READ / PAPER / PAGES.
 */
export async function createLibraryEntry (
	db: SqlExecutor,
	input: CreateLibraryEntryInput,
): Promise<LibraryEntry> {
	const status = input.status ?? 'WANT_TO_READ'
	const format = input.format ?? 'PAPER'
	const progressMode = input.progressMode ?? 'PAGES'
	const finished = resolveFinishedFields({
		status,
		finishedDatePrecision: input.finishedDatePrecision,
		finishedYear: input.finishedYear,
		finishedOn: input.finishedOn,
		finishedAt: input.finishedAt,
	})

	assertEntryPayload({
		status,
		format,
		progressMode,
		currentPage: input.currentPage,
		totalPages: input.totalPages,
		currentPercent: input.currentPercent,
		audioPositionSeconds: input.audioPositionSeconds,
		audioDurationSeconds: input.audioDurationSeconds,
		finishedDatePrecision: finished.finishedDatePrecision,
		finishedYear: finished.finishedYear,
		finishedOn: finished.finishedOn,
		rating: input.rating,
	})

	const id = createId('lib')
	const now = nowIso()

	await db.runAsync(
		`INSERT INTO library_entries (
			id, book_id, status, format, progress_mode,
			current_page, total_pages, current_percent,
			audio_position_seconds, audio_duration_seconds,
			started_at, finished_at, finished_date_precision, finished_year, finished_on,
			rating, review_text, created_at, updated_at, archived_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
		[
			id,
			input.bookId,
			status,
			format,
			progressMode,
			input.currentPage ?? null,
			input.totalPages ?? null,
			input.currentPercent ?? null,
			input.audioPositionSeconds ?? null,
			input.audioDurationSeconds ?? null,
			input.startedAt ?? null,
			finished.finishedAt,
			finished.finishedDatePrecision,
			finished.finishedYear,
			finished.finishedOn,
			input.rating ?? null,
			input.reviewText?.trim() ? input.reviewText.trim() : null,
			now,
			now,
		],
	)

	const created = await getLibraryEntryById(db, id)
	if (!created) {
		throw new Error('LIBRARY_ENTRY_CREATE_FAILED')
	}
	return created
}

export async function updateLibraryEntry (
	db: SqlExecutor,
	id: string,
	input: UpdateLibraryEntryInput,
): Promise<LibraryEntry> {
	const existing = await getLibraryEntryById(db, id)
	if (!existing) {
		throw new Error('LIBRARY_ENTRY_NOT_FOUND')
	}

	const status = input.status ?? existing.status
	const format = input.format ?? existing.format
	const progressMode = input.progressMode ?? existing.progressMode
	const currentPage =
		input.currentPage !== undefined ? input.currentPage : existing.currentPage
	const totalPages =
		input.totalPages !== undefined ? input.totalPages : existing.totalPages
	const currentPercent =
		input.currentPercent !== undefined
			? input.currentPercent
			: existing.currentPercent
	const audioPositionSeconds =
		input.audioPositionSeconds !== undefined
			? input.audioPositionSeconds
			: existing.audioPositionSeconds
	const audioDurationSeconds =
		input.audioDurationSeconds !== undefined
			? input.audioDurationSeconds
			: existing.audioDurationSeconds
	const rating = input.rating !== undefined ? input.rating : existing.rating
	const reviewText =
		input.reviewText !== undefined ? input.reviewText : existing.reviewText
	const startedAt =
		input.startedAt !== undefined ? input.startedAt : existing.startedAt

	const finished = resolveFinishedFields({
		status,
		finishedDatePrecision:
			input.finishedDatePrecision !== undefined
				? input.finishedDatePrecision
				: existing.finishedDatePrecision,
		finishedYear:
			input.finishedYear !== undefined
				? input.finishedYear
				: existing.finishedYear,
		finishedOn:
			input.finishedOn !== undefined ? input.finishedOn : existing.finishedOn,
		finishedAt:
			input.finishedAt !== undefined ? input.finishedAt : existing.finishedAt,
	})

	assertEntryPayload({
		status,
		format,
		progressMode,
		currentPage,
		totalPages,
		currentPercent,
		audioPositionSeconds,
		audioDurationSeconds,
		finishedDatePrecision: finished.finishedDatePrecision,
		finishedYear: finished.finishedYear,
		finishedOn: finished.finishedOn,
		rating,
	})

	const now = nowIso()
	await db.runAsync(
		`UPDATE library_entries SET
			status = ?, format = ?, progress_mode = ?,
			current_page = ?, total_pages = ?, current_percent = ?,
			audio_position_seconds = ?, audio_duration_seconds = ?,
			started_at = ?, finished_at = ?, finished_date_precision = ?,
			finished_year = ?, finished_on = ?, rating = ?, review_text = ?,
			updated_at = ?
		 WHERE id = ?`,
		[
			status,
			format,
			progressMode,
			currentPage,
			totalPages,
			currentPercent,
			audioPositionSeconds,
			audioDurationSeconds,
			startedAt,
			finished.finishedAt,
			finished.finishedDatePrecision,
			finished.finishedYear,
			finished.finishedOn,
			rating,
			reviewText?.trim() ? reviewText.trim() : null,
			now,
			id,
		],
	)

	const updated = await getLibraryEntryById(db, id)
	if (!updated) {
		throw new Error('LIBRARY_ENTRY_UPDATE_FAILED')
	}
	return updated
}

export async function getLibraryEntryById (
	db: SqlExecutor,
	id: string,
): Promise<LibraryEntry | null> {
	const row = await db.getFirstAsync<LibraryEntryRow>(
		`SELECT * FROM library_entries WHERE id = ?`,
		[id],
	)
	return row ? mapLibraryEntry(row) : null
}

export async function listActiveLibraryEntries (
	db: SqlExecutor,
): Promise<LibraryEntry[]> {
	const rows = await db.getAllAsync<LibraryEntryRow>(
		`SELECT * FROM library_entries
		 WHERE archived_at IS NULL
		 ORDER BY updated_at DESC`,
	)
	return rows.map(mapLibraryEntry)
}

export async function listArchivedLibraryEntries (
	db: SqlExecutor,
): Promise<LibraryEntry[]> {
	const rows = await db.getAllAsync<LibraryEntryRow>(
		`SELECT * FROM library_entries
		 WHERE archived_at IS NOT NULL
		 ORDER BY archived_at DESC`,
	)
	return rows.map(mapLibraryEntry)
}

/**
 * Soft-removes a book from the active library without deleting sessions/notes.
 */
export async function archiveLibraryEntry (
	db: SqlExecutor,
	id: string,
): Promise<void> {
	const now = nowIso()
	await db.runAsync(
		`UPDATE library_entries
		 SET archived_at = ?, updated_at = ?
		 WHERE id = ? AND archived_at IS NULL`,
		[now, now, id],
	)
}

/** Restores an archived library entry into the active library. */
export async function restoreLibraryEntry (
	db: SqlExecutor,
	id: string,
): Promise<void> {
	const now = nowIso()
	await db.runAsync(
		`UPDATE library_entries
		 SET archived_at = NULL, updated_at = ?
		 WHERE id = ? AND archived_at IS NOT NULL`,
		[now, id],
	)
}

export async function countActiveLibraryEntries (
	db: SqlExecutor,
): Promise<number> {
	const row = await db.getFirstAsync<{ count: number }>(
		`SELECT COUNT(*) AS count FROM library_entries WHERE archived_at IS NULL`,
	)
	return row?.count ?? 0
}

/**
 * Hard-delete. Fails with FK RESTRICT when reading sessions/notes exist.
 */
export async function deleteLibraryEntryHard (
	db: SqlExecutor,
	id: string,
): Promise<void> {
	const reference = await db.getFirstAsync<{ id: string }>(
		`SELECT id FROM reading_sessions WHERE library_entry_id = ?
		 UNION ALL
		 SELECT id FROM reading_notes WHERE library_entry_id = ? LIMIT 1`,
		[id, id],
	)
	if (reference) {
		throw new Error('LIBRARY_ENTRY_HAS_HISTORY')
	}
	await db.runAsync(`DELETE FROM library_entries WHERE id = ?`, [id])
}
