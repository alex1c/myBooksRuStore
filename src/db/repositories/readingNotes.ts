/**
 * Reading notes repository — quotes, thoughts, and free-form notes.
 */

import type { NoteType } from '@/constants/domain'
import { isNoteType } from '@/constants/domain'
import { ReadingNote } from '@/db/types'
import { SqlExecutor } from '@/db/sqlExecutor'
import { createId } from '@/utils/id'
import { nowIso } from '@/utils/dates'

interface ReadingNoteRow {
	id: string
	library_entry_id: string
	reading_session_id: string | null
	type: string
	text: string
	page: number | null
	percent: number | null
	audio_position_seconds: number | null
	created_at: string
	updated_at: string
}

export interface CreateReadingNoteInput {
	libraryEntryId: string
	type: NoteType
	text: string
	readingSessionId?: string | null
	page?: number | null
	percent?: number | null
	audioPositionSeconds?: number | null
}

export type UpdateReadingNoteInput = Partial<{
	type: NoteType
	text: string
	page: number | null
	percent: number | null
	audioPositionSeconds: number | null
}>

export interface ListNotesQuery {
	libraryEntryId?: string
	types?: NoteType[]
	/** Case-insensitive substring match applied in SQL for ASCII; callers may refine. */
	search?: string
	limit?: number
	offset?: number
}

export function mapReadingNote (row: ReadingNoteRow): ReadingNote {
	if (!isNoteType(row.type)) {
		throw new Error('INVALID_NOTE_TYPE')
	}
	return {
		id: row.id,
		libraryEntryId: row.library_entry_id,
		readingSessionId: row.reading_session_id,
		type: row.type,
		text: row.text,
		page: row.page,
		percent: row.percent,
		audioPositionSeconds: row.audio_position_seconds,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

/**
 * Inserts a note. Outer whitespace is trimmed; internal newlines/spaces kept.
 */
export async function createReadingNote (
	db: SqlExecutor,
	input: CreateReadingNoteInput,
): Promise<ReadingNote> {
	if (!isNoteType(input.type)) {
		throw new Error('INVALID_NOTE_TYPE')
	}
	const text = input.text.trim()
	if (!text) {
		throw new Error('NOTE_TEXT_REQUIRED')
	}

	const entry = await db.getFirstAsync<{ id: string }>(
		`SELECT id FROM library_entries WHERE id = ? LIMIT 1`,
		[input.libraryEntryId],
	)
	if (!entry) {
		throw new Error('LIBRARY_ENTRY_NOT_FOUND')
	}

	if (input.readingSessionId) {
		const session = await db.getFirstAsync<{ id: string }>(
			`SELECT id FROM reading_sessions WHERE id = ? LIMIT 1`,
			[input.readingSessionId],
		)
		if (!session) {
			throw new Error('SESSION_NOT_FOUND')
		}
	}

	const id = createId('note')
	const now = nowIso()

	await db.runAsync(
		`INSERT INTO reading_notes (
			id, library_entry_id, reading_session_id, type, text,
			page, percent, audio_position_seconds, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			id,
			input.libraryEntryId,
			input.readingSessionId ?? null,
			input.type,
			text,
			input.page ?? null,
			input.percent ?? null,
			input.audioPositionSeconds ?? null,
			now,
			now,
		],
	)

	const created = await getReadingNoteById(db, id)
	if (!created) {
		throw new Error('NOTE_CREATE_FAILED')
	}
	return created
}

export async function getReadingNoteById (
	db: SqlExecutor,
	id: string,
): Promise<ReadingNote | null> {
	const row = await db.getFirstAsync<ReadingNoteRow>(
		`SELECT * FROM reading_notes WHERE id = ?`,
		[id],
	)
	return row ? mapReadingNote(row) : null
}

export async function updateReadingNote (
	db: SqlExecutor,
	id: string,
	input: UpdateReadingNoteInput,
): Promise<ReadingNote> {
	const existing = await getReadingNoteById(db, id)
	if (!existing) {
		throw new Error('NOTE_NOT_FOUND')
	}

	const nextType = input.type ?? existing.type
	if (!isNoteType(nextType)) {
		throw new Error('INVALID_NOTE_TYPE')
	}

	const nextText =
		input.text !== undefined ? input.text.trim() : existing.text
	if (!nextText) {
		throw new Error('NOTE_TEXT_REQUIRED')
	}

	const nextPage =
		input.page !== undefined ? input.page : existing.page
	const nextPercent =
		input.percent !== undefined ? input.percent : existing.percent
	const nextAudio =
		input.audioPositionSeconds !== undefined
			? input.audioPositionSeconds
			: existing.audioPositionSeconds

	const now = nowIso()
	await db.runAsync(
		`UPDATE reading_notes SET
			type = ?,
			text = ?,
			page = ?,
			percent = ?,
			audio_position_seconds = ?,
			updated_at = ?
		WHERE id = ?`,
		[nextType, nextText, nextPage, nextPercent, nextAudio, now, id],
	)

	const updated = await getReadingNoteById(db, id)
	if (!updated) {
		throw new Error('NOTE_UPDATE_FAILED')
	}
	return updated
}

/**
 * Hard-deletes a single note. Does not touch books or sessions.
 */
export async function deleteReadingNote (
	db: SqlExecutor,
	id: string,
): Promise<void> {
	const existing = await getReadingNoteById(db, id)
	if (!existing) {
		throw new Error('NOTE_NOT_FOUND')
	}
	await db.runAsync(`DELETE FROM reading_notes WHERE id = ?`, [id])
}

/** Newest-first notes for one library entry (or all when entry omitted). */
export async function listReadingNotes (
	db: SqlExecutor,
	query: ListNotesQuery = {},
): Promise<ReadingNote[]> {
	const clauses: string[] = []
	const params: (string | number)[] = []

	if (query.libraryEntryId) {
		clauses.push('library_entry_id = ?')
		params.push(query.libraryEntryId)
	}
	if (query.types && query.types.length > 0) {
		const placeholders = query.types.map(() => '?').join(', ')
		clauses.push(`type IN (${placeholders})`)
		params.push(...query.types)
	}

	const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
	const limit = query.limit ?? 200
	const offset = query.offset ?? 0
	params.push(limit, offset)

	const rows = await db.getAllAsync<ReadingNoteRow>(
		`SELECT * FROM reading_notes
		 ${where}
		 ORDER BY created_at DESC, id DESC
		 LIMIT ? OFFSET ?`,
		params,
	)
	return rows.map(mapReadingNote)
}

export async function countNotesForEntry (
	db: SqlExecutor,
	libraryEntryId: string,
): Promise<number> {
	const row = await db.getFirstAsync<{ count: number }>(
		`SELECT COUNT(*) AS count FROM reading_notes WHERE library_entry_id = ?`,
		[libraryEntryId],
	)
	return row?.count ?? 0
}

export interface NoteTypeCounts {
	QUOTE: number
	THOUGHT: number
	NOTE: number
	total: number
}

export async function countNotesByTypeForEntry (
	db: SqlExecutor,
	libraryEntryId: string,
): Promise<NoteTypeCounts> {
	const rows = await db.getAllAsync<{ type: string; count: number }>(
		`SELECT type, COUNT(*) AS count
		 FROM reading_notes
		 WHERE library_entry_id = ?
		 GROUP BY type`,
		[libraryEntryId],
	)
	const counts: NoteTypeCounts = {
		QUOTE: 0,
		THOUGHT: 0,
		NOTE: 0,
		total: 0,
	}
	for (const row of rows) {
		if (isNoteType(row.type)) {
			counts[row.type] = row.count
			counts.total += row.count
		}
	}
	return counts
}
