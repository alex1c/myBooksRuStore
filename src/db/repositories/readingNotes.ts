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

function mapNote (row: ReadingNoteRow): ReadingNote {
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
	return row ? mapNote(row) : null
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
