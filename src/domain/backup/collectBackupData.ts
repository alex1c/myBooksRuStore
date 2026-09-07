/**
 * Collect full user state into a BackupArchive (no ZIP yet).
 */

import { LATEST_SCHEMA_VERSION } from '@/db/migrations'
import { getAppSettings } from '@/db/repositories/settings'
import { SqlExecutor } from '@/db/sqlExecutor'
import { nowIso } from '@/utils/dates'
import {
	APP_VERSION,
	BACKUP_COVERS_DIR,
	BACKUP_FORMAT_ID,
	BACKUP_FORMAT_VERSION,
} from './constants'
import { canonicalDataJson, sha256Hex } from './checksum'
import type {
	BackupArchive,
	BackupBook,
	BackupCounts,
	BackupData,
	BackupGoal,
	BackupLibraryEntry,
	BackupLibraryEntryShelf,
	BackupNote,
	BackupProgressEvent,
	BackupSession,
	BackupShelf,
} from './types'

export interface CoverReader {
	/**
	 * Read local cover bytes for a book if a local file exists.
	 * Return null when missing — backup continues without the asset.
	 */
	readLocalCover: (
		bookId: string,
		coverUri: string | null,
	) => Promise<Uint8Array | null>
}

function emptyCoverReader (): CoverReader {
	return {
		async readLocalCover () {
			return null
		},
	}
}

/**
 * Dump all restore-managed tables into a typed archive (+ optional covers).
 */
export async function collectBackupArchive (
	db: SqlExecutor,
	coverReader: CoverReader = emptyCoverReader(),
): Promise<BackupArchive> {
	const [
		bookRows,
		entryRows,
		shelfRows,
		junctionRows,
		sessionRows,
		eventRows,
		noteRows,
		goalRows,
		settings,
	] = await Promise.all([
		db.getAllAsync<Record<string, unknown>>(`SELECT * FROM books`),
		db.getAllAsync<Record<string, unknown>>(`SELECT * FROM library_entries`),
		db.getAllAsync<Record<string, unknown>>(`SELECT * FROM shelves`),
		db.getAllAsync<Record<string, unknown>>(
			`SELECT * FROM library_entry_shelves`,
		),
		db.getAllAsync<Record<string, unknown>>(`SELECT * FROM reading_sessions`),
		db.getAllAsync<Record<string, unknown>>(
			`SELECT * FROM reading_progress_events`,
		),
		db.getAllAsync<Record<string, unknown>>(`SELECT * FROM reading_notes`),
		db.getAllAsync<Record<string, unknown>>(`SELECT * FROM reading_goals`),
		getAppSettings(db),
	])

	const covers: Record<string, Uint8Array> = {}
	let skippedCoverCount = 0
	const books: BackupBook[] = []

	for (const row of bookRows) {
		const id = String(row.id)
		const coverUri =
			row.cover_uri == null ? null : String(row.cover_uri)
		let coverAsset: string | null = null
		const bytes = await coverReader.readLocalCover(id, coverUri)
		if (bytes && bytes.length > 0) {
			coverAsset = `${BACKUP_COVERS_DIR}/${id}.jpg`
			covers[coverAsset] = bytes
		} else if (coverUri && looksLikeLocalPath(coverUri)) {
			skippedCoverCount += 1
		}
		books.push({
			id,
			title: String(row.title),
			subtitle: row.subtitle == null ? null : String(row.subtitle),
			authorText: String(row.author_text ?? ''),
			description: row.description == null ? null : String(row.description),
			isbn10: row.isbn10 == null ? null : String(row.isbn10),
			isbn13: row.isbn13 == null ? null : String(row.isbn13),
			publisher: row.publisher == null ? null : String(row.publisher),
			publishedYear:
				row.published_year == null ? null : Number(row.published_year),
			language: row.language == null ? null : String(row.language),
			pageCount: row.page_count == null ? null : Number(row.page_count),
			coverAsset,
			remoteCoverUrl:
				row.remote_cover_url == null ? null : String(row.remote_cover_url),
			source: row.source == null ? null : String(row.source),
			sourceExternalId:
				row.source_external_id == null
					? null
					: String(row.source_external_id),
			createdAt: String(row.created_at),
			updatedAt: String(row.updated_at),
			archivedAt: row.archived_at == null ? null : String(row.archived_at),
		})
	}

	const libraryEntries: BackupLibraryEntry[] = entryRows.map((row) => ({
		id: String(row.id),
		bookId: String(row.book_id),
		status: row.status as BackupLibraryEntry['status'],
		format: row.format as BackupLibraryEntry['format'],
		progressMode: row.progress_mode as BackupLibraryEntry['progressMode'],
		currentPage: row.current_page == null ? null : Number(row.current_page),
		totalPages: row.total_pages == null ? null : Number(row.total_pages),
		currentPercent:
			row.current_percent == null ? null : Number(row.current_percent),
		audioPositionSeconds:
			row.audio_position_seconds == null
				? null
				: Number(row.audio_position_seconds),
		audioDurationSeconds:
			row.audio_duration_seconds == null
				? null
				: Number(row.audio_duration_seconds),
		startedAt: row.started_at == null ? null : String(row.started_at),
		finishedAt: row.finished_at == null ? null : String(row.finished_at),
		finishedDatePrecision:
			row.finished_date_precision == null
				? null
				: (row.finished_date_precision as BackupLibraryEntry['finishedDatePrecision']),
		finishedYear:
			row.finished_year == null ? null : Number(row.finished_year),
		finishedOn: row.finished_on == null ? null : String(row.finished_on),
		rating: row.rating == null ? null : Number(row.rating),
		reviewText: row.review_text == null ? null : String(row.review_text),
		createdAt: String(row.created_at),
		updatedAt: String(row.updated_at),
		archivedAt: row.archived_at == null ? null : String(row.archived_at),
	}))

	const shelves: BackupShelf[] = shelfRows.map((row) => ({
		id: String(row.id),
		name: String(row.name),
		createdAt: String(row.created_at),
		updatedAt: String(row.updated_at),
		archivedAt: row.archived_at == null ? null : String(row.archived_at),
	}))

	const libraryEntryShelves: BackupLibraryEntryShelf[] = junctionRows.map(
		(row) => ({
			libraryEntryId: String(row.library_entry_id),
			shelfId: String(row.shelf_id),
			createdAt: String(row.created_at),
		}),
	)

	const readingSessions: BackupSession[] = sessionRows.map((row) => ({
		id: String(row.id),
		libraryEntryId: String(row.library_entry_id),
		startedAt: String(row.started_at),
		endedAt: row.ended_at == null ? null : String(row.ended_at),
		durationSeconds:
			row.duration_seconds == null ? null : Number(row.duration_seconds),
		startPage: row.start_page == null ? null : Number(row.start_page),
		endPage: row.end_page == null ? null : Number(row.end_page),
		startPercent: row.start_percent == null ? null : Number(row.start_percent),
		endPercent: row.end_percent == null ? null : Number(row.end_percent),
		startAudioSeconds:
			row.start_audio_seconds == null
				? null
				: Number(row.start_audio_seconds),
		endAudioSeconds:
			row.end_audio_seconds == null ? null : Number(row.end_audio_seconds),
		createdAt: String(row.created_at),
		updatedAt: String(row.updated_at),
	}))

	const readingProgressEvents: BackupProgressEvent[] = eventRows.map(
		(row) => ({
			id: String(row.id),
			libraryEntryId: String(row.library_entry_id),
			readingSessionId:
				row.reading_session_id == null
					? null
					: String(row.reading_session_id),
			type: row.type as BackupProgressEvent['type'],
			previousPage:
				row.previous_page == null ? null : Number(row.previous_page),
			newPage: row.new_page == null ? null : Number(row.new_page),
			previousPercent:
				row.previous_percent == null ? null : Number(row.previous_percent),
			newPercent: row.new_percent == null ? null : Number(row.new_percent),
			previousAudioSeconds:
				row.previous_audio_seconds == null
					? null
					: Number(row.previous_audio_seconds),
			newAudioSeconds:
				row.new_audio_seconds == null
					? null
					: Number(row.new_audio_seconds),
			createdAt: String(row.created_at),
		}),
	)

	const readingNotes: BackupNote[] = noteRows.map((row) => ({
		id: String(row.id),
		libraryEntryId: String(row.library_entry_id),
		readingSessionId:
			row.reading_session_id == null ? null : String(row.reading_session_id),
		type: row.type as BackupNote['type'],
		text: String(row.text),
		page: row.page == null ? null : Number(row.page),
		percent: row.percent == null ? null : Number(row.percent),
		audioPositionSeconds:
			row.audio_position_seconds == null
				? null
				: Number(row.audio_position_seconds),
		createdAt: String(row.created_at),
		updatedAt: String(row.updated_at),
	}))

	const readingGoals: BackupGoal[] = goalRows.map((row) => ({
		id: String(row.id),
		type: row.type as BackupGoal['type'],
		period: row.period as BackupGoal['period'],
		targetValue: Number(row.target_value),
		startsOn: String(row.starts_on),
		endsOn: row.ends_on == null ? null : String(row.ends_on),
		createdAt: String(row.created_at),
		updatedAt: String(row.updated_at),
		archivedAt: row.archived_at == null ? null : String(row.archived_at),
	}))

	const data: BackupData = {
		books,
		libraryEntries,
		shelves,
		libraryEntryShelves,
		readingSessions,
		readingProgressEvents,
		readingNotes,
		readingGoals,
		settings,
	}

	const counts: BackupCounts = {
		books: books.length,
		libraryEntries: libraryEntries.length,
		shelves: shelves.length,
		libraryEntryShelves: libraryEntryShelves.length,
		readingSessions: readingSessions.length,
		readingProgressEvents: readingProgressEvents.length,
		readingNotes: readingNotes.length,
		readingGoals: readingGoals.length,
		settings: 1,
		covers: Object.keys(covers).length,
	}

	const dataSha256 = await sha256Hex(canonicalDataJson(data))

	return {
		manifest: {
			format: BACKUP_FORMAT_ID,
			formatVersion: BACKUP_FORMAT_VERSION,
			schemaVersion: LATEST_SCHEMA_VERSION,
			appVersion: APP_VERSION,
			createdAt: nowIso(),
			counts,
			dataSha256,
			skippedCoverCount,
		},
		data,
		covers,
	}
}

function looksLikeLocalPath (uri: string): boolean {
	return (
		uri.startsWith('file:') ||
		uri.includes('/covers/') ||
		uri.includes('\\covers\\')
	)
}

/** Live counts for UI trust badges. */
export async function getBackupEntityCounts (
	db: SqlExecutor,
): Promise<{
	books: number
	sessions: number
	notes: number
}> {
	const books = await db.getFirstAsync<{ c: number }>(
		`SELECT COUNT(*) AS c FROM books`,
	)
	const sessions = await db.getFirstAsync<{ c: number }>(
		`SELECT COUNT(*) AS c FROM reading_sessions`,
	)
	const notes = await db.getFirstAsync<{ c: number }>(
		`SELECT COUNT(*) AS c FROM reading_notes`,
	)
	return {
		books: books?.c ?? 0,
		sessions: sessions?.c ?? 0,
		notes: notes?.c ?? 0,
	}
}
