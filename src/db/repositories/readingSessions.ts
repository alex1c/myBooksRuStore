/**
 * Reading sessions repository — active + completed sessions.
 * Active session = started_at set AND ended_at IS NULL.
 */

import { ReadingSession } from '@/db/types'
import { SqlExecutor } from '@/db/sqlExecutor'
import { createId } from '@/utils/id'
import { nowIso } from '@/utils/dates'

interface ReadingSessionRow {
	id: string
	library_entry_id: string
	started_at: string
	ended_at: string | null
	duration_seconds: number | null
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

export interface StartActiveSessionInput {
	libraryEntryId: string
	startedAt?: string
	startPage?: number | null
	startPercent?: number | null
	startAudioSeconds?: number | null
}

export interface FinishSessionInput {
	endedAt: string
	durationSeconds: number
	endPage?: number | null
	endPercent?: number | null
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

async function assertEntryExists (
	db: SqlExecutor,
	libraryEntryId: string,
): Promise<void> {
	const entry = await db.getFirstAsync<{ id: string }>(
		`SELECT id FROM library_entries WHERE id = ? LIMIT 1`,
		[libraryEntryId],
	)
	if (!entry) {
		throw new Error('LIBRARY_ENTRY_NOT_FOUND')
	}
}

/**
 * Inserts a completed reading session (legacy / direct write path).
 */
export async function createReadingSession (
	db: SqlExecutor,
	input: CreateReadingSessionInput,
): Promise<ReadingSession> {
	if (input.durationSeconds < 0) {
		throw new Error('INVALID_DURATION')
	}
	await assertEntryExists(db, input.libraryEntryId)

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

/**
 * Creates an unfinished session (ended_at NULL). Enforced unique by index.
 */
export async function startActiveSession (
	db: SqlExecutor,
	input: StartActiveSessionInput,
): Promise<ReadingSession> {
	await assertEntryExists(db, input.libraryEntryId)

	const existing = await getActiveSession(db)
	if (existing) {
		throw new Error('ACTIVE_SESSION_EXISTS')
	}

	const id = createId('session')
	const now = nowIso()
	const startedAt = input.startedAt ?? now

	try {
		await db.runAsync(
			`INSERT INTO reading_sessions (
				id, library_entry_id, started_at, ended_at, duration_seconds,
				start_page, end_page, start_percent, end_percent,
				start_audio_seconds, end_audio_seconds, created_at, updated_at
			) VALUES (?, ?, ?, NULL, NULL, ?, NULL, ?, NULL, ?, NULL, ?, ?)`,
			[
				id,
				input.libraryEntryId,
				startedAt,
				input.startPage ?? null,
				input.startPercent ?? null,
				input.startAudioSeconds ?? null,
				now,
				now,
			],
		)
	} catch (error) {
		// Unique partial index / race: surface a stable domain error.
		const message = error instanceof Error ? error.message : String(error)
		if (
			message.includes('UNIQUE') ||
			message.includes('idx_reading_sessions_one_active')
		) {
			throw new Error('ACTIVE_SESSION_EXISTS')
		}
		throw error
	}

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

/** Returns the single unfinished session, if any. */
export async function getActiveSession (
	db: SqlExecutor,
): Promise<ReadingSession | null> {
	const row = await db.getFirstAsync<ReadingSessionRow>(
		`SELECT * FROM reading_sessions WHERE ended_at IS NULL LIMIT 1`,
	)
	return row ? mapSession(row) : null
}

/**
 * Completes an active session in place (caller updates library progress).
 */
export async function finishActiveSession (
	db: SqlExecutor,
	sessionId: string,
	input: FinishSessionInput,
): Promise<ReadingSession> {
	if (input.durationSeconds < 0) {
		throw new Error('INVALID_DURATION')
	}

	const existing = await getReadingSessionById(db, sessionId)
	if (!existing) {
		throw new Error('SESSION_NOT_FOUND')
	}
	if (existing.endedAt != null) {
		throw new Error('SESSION_ALREADY_ENDED')
	}

	const now = nowIso()
	await db.runAsync(
		`UPDATE reading_sessions SET
			ended_at = ?,
			duration_seconds = ?,
			end_page = ?,
			end_percent = ?,
			end_audio_seconds = ?,
			updated_at = ?
		WHERE id = ? AND ended_at IS NULL`,
		[
			input.endedAt,
			input.durationSeconds,
			input.endPage ?? null,
			input.endPercent ?? null,
			input.endAudioSeconds ?? null,
			now,
			sessionId,
		],
	)

	const updated = await getReadingSessionById(db, sessionId)
	if (!updated || updated.endedAt == null) {
		throw new Error('SESSION_FINISH_FAILED')
	}
	return updated
}

/**
 * Deletes an unfinished session without touching book progress.
 */
export async function cancelActiveSession (
	db: SqlExecutor,
	sessionId: string,
): Promise<void> {
	const existing = await getReadingSessionById(db, sessionId)
	if (!existing) {
		throw new Error('SESSION_NOT_FOUND')
	}
	if (existing.endedAt != null) {
		throw new Error('SESSION_ALREADY_ENDED')
	}

	await db.runAsync(`DELETE FROM reading_sessions WHERE id = ? AND ended_at IS NULL`, [
		sessionId,
	])
}

/**
 * Deletes a completed session record. Does not recalculate book progress.
 */
export async function deleteReadingSession (
	db: SqlExecutor,
	sessionId: string,
): Promise<void> {
	const existing = await getReadingSessionById(db, sessionId)
	if (!existing) {
		throw new Error('SESSION_NOT_FOUND')
	}
	await db.runAsync(`DELETE FROM reading_sessions WHERE id = ?`, [sessionId])
}

/** Newest-first history for one library entry (completed + optional active). */
export async function listSessionsForEntry (
	db: SqlExecutor,
	libraryEntryId: string,
): Promise<ReadingSession[]> {
	const rows = await db.getAllAsync<ReadingSessionRow>(
		`SELECT * FROM reading_sessions
		 WHERE library_entry_id = ?
		 ORDER BY started_at DESC, created_at DESC`,
		[libraryEntryId],
	)
	return rows.map(mapSession)
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
