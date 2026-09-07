/**
 * Atomic full restore — replace restore-managed user data.
 */

import {
	DEFAULT_REMINDER_WEEKDAYS,
	setAnalyticsConsent,
	setDefaultProgressMode,
	setOnboardingCompleted,
	setReminderEnabled,
	setReminderTime,
	setReminderWeekdays,
	setThemePreference,
} from '@/db/repositories/settings'
import { SqlExecutor } from '@/db/sqlExecutor'
import { collectBackupArchive } from './collectBackupData'
import type { BackupArchive, BackupData } from './types'
import { validateBackupArchive } from './validateBackup'

export interface CoverWriter {
	/**
	 * Write cover bytes to local storage. Returns absolute cover URI or null.
	 */
	writeCover: (
		bookId: string,
		relativeAsset: string,
		bytes: Uint8Array,
	) => Promise<string | null>
	/** Optional: clear previous covers directory before writing. */
	clearCovers?: () => Promise<void>
}

/**
 * Validate + transactionally replace DB. Covers restored after successful commit.
 */
export async function restoreBackupArchive (
	db: SqlExecutor,
	archive: BackupArchive,
	coverWriter?: CoverWriter,
): Promise<void> {
	await validateBackupArchive(archive)

	if (!db.withTransactionAsync) {
		throw new Error('TRANSACTIONS_UNAVAILABLE')
	}

	await db.withTransactionAsync(async () => {
		await clearUserData(db)
		await insertBackupData(db, archive.data)
		await applySettings(db, archive.data)
		const violations = await db.getAllAsync<{ table: string }>(
			`PRAGMA foreign_key_check`,
		)
		if (violations.length > 0) {
			throw new Error('FOREIGN_KEY_CHECK_FAILED')
		}
		await assertRestoredCounts(db, archive)
	})

	if (coverWriter) {
		if (coverWriter.clearCovers) {
			await coverWriter.clearCovers().catch(() => undefined)
		}
		for (const book of archive.data.books) {
			if (!book.coverAsset) {
				continue
			}
			const bytes = archive.covers[book.coverAsset]
			if (!bytes) {
				continue
			}
			try {
				const uri = await coverWriter.writeCover(
					book.id,
					book.coverAsset,
					bytes,
				)
				if (uri) {
					await db.runAsync(
						`UPDATE books SET cover_uri = ?, updated_at = updated_at WHERE id = ?`,
						[uri, book.id],
					)
				}
			} catch {
				// Cover failure must not undo a successful data restore.
			}
		}
	}
}

async function clearUserData (db: SqlExecutor): Promise<void> {
	await db.runAsync(`DELETE FROM library_entry_shelves`)
	await db.runAsync(`DELETE FROM reading_notes`)
	await db.runAsync(`DELETE FROM reading_progress_events`)
	await db.runAsync(`DELETE FROM reading_sessions`)
	await db.runAsync(`DELETE FROM library_entries`)
	await db.runAsync(`DELETE FROM books`)
	await db.runAsync(`DELETE FROM shelves`)
	await db.runAsync(`DELETE FROM reading_goals`)
}

async function insertBackupData (
	db: SqlExecutor,
	data: BackupData,
): Promise<void> {
	for (const book of data.books) {
		await db.runAsync(
			`INSERT INTO books (
				id, title, subtitle, author_text, description, isbn10, isbn13,
				publisher, published_year, language, page_count, cover_uri,
				remote_cover_url, source, source_external_id,
				created_at, updated_at, archived_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				book.id,
				book.title,
				book.subtitle,
				book.authorText,
				book.description,
				book.isbn10,
				book.isbn13,
				book.publisher,
				book.publishedYear,
				book.language,
				book.pageCount,
				null, // cover_uri set after files are written
				book.remoteCoverUrl,
				book.source,
				book.sourceExternalId,
				book.createdAt,
				book.updatedAt,
				book.archivedAt,
			],
		)
	}

	for (const shelf of data.shelves) {
		await db.runAsync(
			`INSERT INTO shelves (id, name, created_at, updated_at, archived_at)
			 VALUES (?, ?, ?, ?, ?)`,
			[
				shelf.id,
				shelf.name,
				shelf.createdAt,
				shelf.updatedAt,
				shelf.archivedAt,
			],
		)
	}

	for (const goal of data.readingGoals) {
		await db.runAsync(
			`INSERT INTO reading_goals (
				id, type, period, target_value, starts_on, ends_on,
				created_at, updated_at, archived_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				goal.id,
				goal.type,
				goal.period,
				goal.targetValue,
				goal.startsOn,
				goal.endsOn,
				goal.createdAt,
				goal.updatedAt,
				goal.archivedAt,
			],
		)
	}

	for (const entry of data.libraryEntries) {
		await db.runAsync(
			`INSERT INTO library_entries (
				id, book_id, status, format, progress_mode,
				current_page, total_pages, current_percent,
				audio_position_seconds, audio_duration_seconds,
				started_at, finished_at, finished_date_precision,
				finished_year, finished_on, rating, review_text,
				created_at, updated_at, archived_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				entry.id,
				entry.bookId,
				entry.status,
				entry.format,
				entry.progressMode,
				entry.currentPage,
				entry.totalPages,
				entry.currentPercent,
				entry.audioPositionSeconds,
				entry.audioDurationSeconds,
				entry.startedAt,
				entry.finishedAt,
				entry.finishedDatePrecision,
				entry.finishedYear,
				entry.finishedOn,
				entry.rating,
				entry.reviewText,
				entry.createdAt,
				entry.updatedAt,
				entry.archivedAt,
			],
		)
	}

	for (const session of data.readingSessions) {
		await db.runAsync(
			`INSERT INTO reading_sessions (
				id, library_entry_id, started_at, ended_at, duration_seconds,
				start_page, end_page, start_percent, end_percent,
				start_audio_seconds, end_audio_seconds, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				session.id,
				session.libraryEntryId,
				session.startedAt,
				session.endedAt,
				session.durationSeconds,
				session.startPage,
				session.endPage,
				session.startPercent,
				session.endPercent,
				session.startAudioSeconds,
				session.endAudioSeconds,
				session.createdAt,
				session.updatedAt,
			],
		)
	}

	for (const ev of data.readingProgressEvents) {
		await db.runAsync(
			`INSERT INTO reading_progress_events (
				id, library_entry_id, reading_session_id, type,
				previous_page, new_page, previous_percent, new_percent,
				previous_audio_seconds, new_audio_seconds, created_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				ev.id,
				ev.libraryEntryId,
				ev.readingSessionId,
				ev.type,
				ev.previousPage,
				ev.newPage,
				ev.previousPercent,
				ev.newPercent,
				ev.previousAudioSeconds,
				ev.newAudioSeconds,
				ev.createdAt,
			],
		)
	}

	for (const note of data.readingNotes) {
		await db.runAsync(
			`INSERT INTO reading_notes (
				id, library_entry_id, reading_session_id, type, text,
				page, percent, audio_position_seconds, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				note.id,
				note.libraryEntryId,
				note.readingSessionId,
				note.type,
				note.text,
				note.page,
				note.percent,
				note.audioPositionSeconds,
				note.createdAt,
				note.updatedAt,
			],
		)
	}

	for (const j of data.libraryEntryShelves) {
		await db.runAsync(
			`INSERT INTO library_entry_shelves (library_entry_id, shelf_id, created_at)
			 VALUES (?, ?, ?)`,
			[j.libraryEntryId, j.shelfId, j.createdAt],
		)
	}
}

async function applySettings (
	db: SqlExecutor,
	data: BackupData,
): Promise<void> {
	const s = data.settings
	await setReminderEnabled(db, s.reminderEnabled)
	await setReminderTime(db, s.reminderTime)
	await setReminderWeekdays(
		db,
		s.reminderWeekdays?.length
			? s.reminderWeekdays
			: [...DEFAULT_REMINDER_WEEKDAYS],
	)
	await setDefaultProgressMode(db, s.defaultProgressMode)
	await setThemePreference(db, s.theme)
	await setOnboardingCompleted(db, s.onboardingCompleted)
	if (s.analyticsConsent === null) {
		await db.runAsync(`DELETE FROM app_meta WHERE key = ?`, [
			'analytics_consent',
		])
	} else {
		await setAnalyticsConsent(db, s.analyticsConsent)
	}
}

async function assertRestoredCounts (
	db: SqlExecutor,
	archive: BackupArchive,
): Promise<void> {
	const c = archive.manifest.counts
	const checks: [string, number][] = [
		['books', c.books],
		['library_entries', c.libraryEntries],
		['shelves', c.shelves],
		['library_entry_shelves', c.libraryEntryShelves],
		['reading_sessions', c.readingSessions],
		['reading_progress_events', c.readingProgressEvents],
		['reading_notes', c.readingNotes],
		['reading_goals', c.readingGoals],
	]
	for (const [table, expected] of checks) {
		const row = await db.getFirstAsync<{ c: number }>(
			`SELECT COUNT(*) AS c FROM ${table}`,
		)
		if ((row?.c ?? -1) !== expected) {
			throw new Error(`RESTORE_COUNT_MISMATCH:${table}`)
		}
	}
}

/**
 * Canonical snapshot for round-trip semantic comparison (tests).
 */
export async function snapshotUserData (db: SqlExecutor): Promise<{
	books: unknown[]
	libraryEntries: unknown[]
	shelves: unknown[]
	libraryEntryShelves: unknown[]
	readingSessions: unknown[]
	readingProgressEvents: unknown[]
	readingNotes: unknown[]
	readingGoals: unknown[]
	settings: unknown
}> {
	const archive = await collectBackupArchive(db)
	return {
		books: archive.data.books,
		libraryEntries: archive.data.libraryEntries,
		shelves: archive.data.shelves,
		libraryEntryShelves: archive.data.libraryEntryShelves,
		readingSessions: archive.data.readingSessions,
		readingProgressEvents: archive.data.readingProgressEvents,
		readingNotes: archive.data.readingNotes,
		readingGoals: archive.data.readingGoals,
		settings: archive.data.settings,
	}
}
