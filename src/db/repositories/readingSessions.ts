import { ReadingSession } from '@/db/types'
import { SqlExecutor } from '@/db/sqlExecutor'
import { createId } from '@/utils/id'
import { nowIso } from '@/utils/dates'

interface ReadingSessionRow {
	id: string
	library_entry_id: string
	started_at: string
	ended_at: string
	duration_seconds: number
	start_page: number | null
	end_page: number | null
	start_percent: number | null
	end_percent: number | null
	start_audio_seconds: number | null
	end_audio_seconds: number | null
	created_at: string
	updated_at: string
}

export interface CreateReadingSessionInput {
	libraryEntryId: string
	startedAt: string
	endedAt: string
	durationSeconds: number
	startPage?: number | null
	endPage?: number | null
	startPercent?: number | null
	endPercent?: number | null
	startAudioSeconds?: number | null
	endAudioSeconds?: number | null
}

function mapSession (row: ReadingSessionRow): ReadingSession {
	return {
		id: row.id,
		libraryEntryId: row.library_entry_id,
		startedAt: row.started_at,
		endedAt: row.ended_at,
		durationSeconds: row.duration_seconds,
		startPage: row.start_page,
		endPage: row.end_page,
		startPercent: row.start_percent,
		endPercent: row.end_percent,
		startAudioSeconds: row.start_audio_seconds,
		endAudioSeconds: row.end_audio_seconds,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}
}

/**
 * Inserts a completed reading session (timer UI comes in a later phase).
 */
export async function createReadingSession (
	db: SqlExecutor,
	input: CreateReadingSessionInput,
): Promise<ReadingSession> {
	if (input.durationSeconds < 0) {
		throw new Error('INVALID_DURATION')
	}
	const entry = await db.getFirstAsync<{ id: string }>(
		`SELECT id FROM library_entries WHERE id = ? LIMIT 1`,
		[input.libraryEntryId],
	)
	if (!entry) {
		throw new Error('LIBRARY_ENTRY_NOT_FOUND')
	}

	const id = createId('session')
	const now = nowIso()

	await db.runAsync(
		`INSERT INTO reading_sessions (
			id, library_entry_id, started_at, ended_at, duration_seconds,
			start_page, end_page, start_percent, end_percent,
			start_audio_seconds, end_audio_seconds, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			id,
			input.libraryEntryId,
			input.startedAt,
			input.endedAt,
			input.durationSeconds,
			input.startPage ?? null,
			input.endPage ?? null,
			input.startPercent ?? null,
			input.endPercent ?? null,
			input.startAudioSeconds ?? null,
			input.endAudioSeconds ?? null,
			now,
			now,
		],
	)

	const created = await getReadingSessionById(db, id)
	if (!created) {
		throw new Error('SESSION_CREATE_FAILED')
	}
	return created
}

export async function getReadingSessionById (
	db: SqlExecutor,
	id: string,
): Promise<ReadingSession | null> {
	const row = await db.getFirstAsync<ReadingSessionRow>(
		`SELECT * FROM reading_sessions WHERE id = ?`,
		[id],
	)
	return row ? mapSession(row) : null
}

export async function countSessionsForEntry (
	db: SqlExecutor,
	libraryEntryId: string,
): Promise<number> {
	const row = await db.getFirstAsync<{ count: number }>(
		`SELECT COUNT(*) AS count FROM reading_sessions WHERE library_entry_id = ?`,
		[libraryEntryId],
	)
	return row?.count ?? 0
}
