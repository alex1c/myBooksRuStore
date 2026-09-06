/**
 * Progress event audit trail — supports undo and future diary/statistics.
 */

import type { ProgressEventType, ReadingProgressEvent } from '@/db/types'
import { SqlExecutor } from '@/db/sqlExecutor'
import { createId } from '@/utils/id'
import { nowIso } from '@/utils/dates'

interface ProgressEventRow {
	id: string
	library_entry_id: string
	reading_session_id: string | null
	type: string
	previous_page: number | null
	new_page: number | null
	previous_percent: number | null
	new_percent: number | null
	previous_audio_seconds: number | null
	new_audio_seconds: number | null
	created_at: string
}

export interface CreateProgressEventInput {
	libraryEntryId: string
	readingSessionId?: string | null
	type: ProgressEventType
	previousPage?: number | null
	newPage?: number | null
	previousPercent?: number | null
	newPercent?: number | null
	previousAudioSeconds?: number | null
	newAudioSeconds?: number | null
	createdAt?: string
}

function mapEvent (row: ProgressEventRow): ReadingProgressEvent {
	return {
		id: row.id,
		libraryEntryId: row.library_entry_id,
		readingSessionId: row.reading_session_id,
		type: row.type as ProgressEventType,
		previousPage: row.previous_page,
		newPage: row.new_page,
		previousPercent: row.previous_percent,
		newPercent: row.new_percent,
		previousAudioSeconds: row.previous_audio_seconds,
		newAudioSeconds: row.new_audio_seconds,
		createdAt: row.created_at,
	}
}

export async function createProgressEvent (
	db: SqlExecutor,
	input: CreateProgressEventInput,
): Promise<ReadingProgressEvent> {
	const id = createId('progress')
	const createdAt = input.createdAt ?? nowIso()

	await db.runAsync(
		`INSERT INTO reading_progress_events (
			id, library_entry_id, reading_session_id, type,
			previous_page, new_page, previous_percent, new_percent,
			previous_audio_seconds, new_audio_seconds, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			id,
			input.libraryEntryId,
			input.readingSessionId ?? null,
			input.type,
			input.previousPage ?? null,
			input.newPage ?? null,
			input.previousPercent ?? null,
			input.newPercent ?? null,
			input.previousAudioSeconds ?? null,
			input.newAudioSeconds ?? null,
			createdAt,
		],
	)

	const created = await getProgressEventById(db, id)
	if (!created) {
		throw new Error('PROGRESS_EVENT_CREATE_FAILED')
	}
	return created
}

export async function getProgressEventById (
	db: SqlExecutor,
	id: string,
): Promise<ReadingProgressEvent | null> {
	const row = await db.getFirstAsync<ProgressEventRow>(
		`SELECT * FROM reading_progress_events WHERE id = ?`,
		[id],
	)
	return row ? mapEvent(row) : null
}

export async function listProgressEventsForEntry (
	db: SqlExecutor,
	libraryEntryId: string,
	limit = 50,
): Promise<ReadingProgressEvent[]> {
	const rows = await db.getAllAsync<ProgressEventRow>(
		`SELECT * FROM reading_progress_events
		 WHERE library_entry_id = ?
		 ORDER BY created_at DESC
		 LIMIT ?`,
		[libraryEntryId, limit],
	)
	return rows.map(mapEvent)
}
