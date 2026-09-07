/**
 * Validate backup archive before destructive restore.
 */

import {
	isBookFormat,
	isFinishedDatePrecision,
	isGoalPeriod,
	isGoalType,
	isLibraryStatus,
	isNoteType,
	isProgressMode,
	isThemePreference,
} from '@/constants/domain'
import {
	BACKUP_FORMAT_ID,
	BACKUP_FORMAT_VERSION,
} from './constants'
import { canonicalDataJson, sha256Hex } from './checksum'
import {
	BackupValidationError,
	type BackupArchive,
	type BackupData,
	type BackupManifest,
} from './types'

const PROGRESS_EVENT_TYPES = new Set([
	'QUICK_UPDATE',
	'MANUAL_UPDATE',
	'SESSION_END',
	'FINISH_BOOK',
	'UNDO',
])

/**
 * Structural + referential validation. Throws BackupValidationError.
 */
export async function validateBackupArchive (
	archive: BackupArchive,
	opts: { verifyChecksum?: boolean } = { verifyChecksum: true },
): Promise<void> {
	validateManifest(archive.manifest)

	if (archive.manifest.formatVersion > BACKUP_FORMAT_VERSION) {
		throw new BackupValidationError(
			'UNSUPPORTED_FUTURE_VERSION',
			'Эта резервная копия создана более новой версией приложения.',
		)
	}
	if (archive.manifest.formatVersion < 1) {
		throw new BackupValidationError(
			'UNSUPPORTED_OLD_VERSION',
			'Неподдерживаемая версия резервной копии.',
		)
	}

	// Hook for future: migrateBackupV1ToCurrent(archive)
	migrateBackupToCurrent(archive)

	validateDataShape(archive.data)
	validateUniqueIds(archive.data)
	validateForeignKeys(archive.data)

	if (opts.verifyChecksum !== false) {
		const actual = await sha256Hex(canonicalDataJson(archive.data))
		if (
			archive.manifest.dataSha256 &&
			actual.toLowerCase() !== archive.manifest.dataSha256.toLowerCase()
		) {
			throw new BackupValidationError(
				'CHECKSUM_MISMATCH',
				'Контрольная сумма данных не совпадает.',
			)
		}
	}

	const c = archive.manifest.counts
	const d = archive.data
	if (
		c.books !== d.books.length ||
		c.libraryEntries !== d.libraryEntries.length ||
		c.shelves !== d.shelves.length ||
		c.libraryEntryShelves !== d.libraryEntryShelves.length ||
		c.readingSessions !== d.readingSessions.length ||
		c.readingProgressEvents !== d.readingProgressEvents.length ||
		c.readingNotes !== d.readingNotes.length ||
		c.readingGoals !== d.readingGoals.length
	) {
		throw new BackupValidationError(
			'COUNT_MISMATCH',
			'Счётчики манифеста не совпадают с данными.',
		)
	}
}

export function validateManifest (manifest: BackupManifest): void {
	if (!manifest || typeof manifest !== 'object') {
		throw new BackupValidationError('INVALID_FORMAT', 'Нет манифеста.')
	}
	if (manifest.format !== BACKUP_FORMAT_ID) {
		throw new BackupValidationError(
			'INVALID_FORMAT',
			'Файл не является резервной копией «Дневник чтения».',
		)
	}
	if (typeof manifest.formatVersion !== 'number') {
		throw new BackupValidationError('MALFORMED_DATA', 'formatVersion')
	}
	if (typeof manifest.schemaVersion !== 'number') {
		throw new BackupValidationError('MALFORMED_DATA', 'schemaVersion')
	}
	if (!manifest.createdAt || Number.isNaN(Date.parse(manifest.createdAt))) {
		throw new BackupValidationError('MALFORMED_DATA', 'createdAt')
	}
	if (!manifest.counts || typeof manifest.counts !== 'object') {
		throw new BackupValidationError('MALFORMED_DATA', 'counts')
	}
}

/**
 * Placeholder for future format migrations. Currently v1 is current.
 */
export function migrateBackupToCurrent (archive: BackupArchive): BackupArchive {
	if (archive.manifest.formatVersion === 1) {
		return archive
	}
	return archive
}

function validateDataShape (data: BackupData): void {
	const arrays: (keyof BackupData)[] = [
		'books',
		'libraryEntries',
		'shelves',
		'libraryEntryShelves',
		'readingSessions',
		'readingProgressEvents',
		'readingNotes',
		'readingGoals',
	]
	for (const key of arrays) {
		if (!Array.isArray(data[key])) {
			throw new BackupValidationError('MALFORMED_DATA', String(key))
		}
	}
	if (!data.settings || typeof data.settings !== 'object') {
		throw new BackupValidationError('MALFORMED_DATA', 'settings')
	}
	if (!isProgressMode(data.settings.defaultProgressMode)) {
		throw new BackupValidationError('MALFORMED_DATA', 'defaultProgressMode')
	}
	if (!isThemePreference(data.settings.theme)) {
		throw new BackupValidationError('MALFORMED_DATA', 'theme')
	}

	for (const book of data.books) {
		if (!book.id || !book.title) {
			throw new BackupValidationError('MALFORMED_DATA', 'book')
		}
	}
	for (const entry of data.libraryEntries) {
		if (
			!entry.id ||
			!entry.bookId ||
			!isLibraryStatus(entry.status) ||
			!isBookFormat(entry.format) ||
			!isProgressMode(entry.progressMode)
		) {
			throw new BackupValidationError('MALFORMED_DATA', 'libraryEntry')
		}
		if (
			entry.finishedDatePrecision != null &&
			!isFinishedDatePrecision(entry.finishedDatePrecision)
		) {
			throw new BackupValidationError('MALFORMED_DATA', 'finishedDatePrecision')
		}
	}
	for (const session of data.readingSessions) {
		if (!session.id || !session.libraryEntryId || !session.startedAt) {
			throw new BackupValidationError('MALFORMED_DATA', 'session')
		}
	}
	for (const note of data.readingNotes) {
		if (!note.id || !note.libraryEntryId || !isNoteType(note.type) || !note.text) {
			throw new BackupValidationError('MALFORMED_DATA', 'note')
		}
	}
	for (const ev of data.readingProgressEvents) {
		if (
			!ev.id ||
			!ev.libraryEntryId ||
			!PROGRESS_EVENT_TYPES.has(ev.type)
		) {
			throw new BackupValidationError('MALFORMED_DATA', 'progressEvent')
		}
	}
	for (const goal of data.readingGoals) {
		if (
			!goal.id ||
			!isGoalType(goal.type) ||
			!isGoalPeriod(goal.period) ||
			!(goal.targetValue > 0)
		) {
			throw new BackupValidationError('MALFORMED_DATA', 'goal')
		}
	}
}

function validateUniqueIds (data: BackupData): void {
	assertUnique(
		data.books.map((b) => b.id),
		'books',
	)
	assertUnique(
		data.libraryEntries.map((e) => e.id),
		'libraryEntries',
	)
	assertUnique(
		data.shelves.map((s) => s.id),
		'shelves',
	)
	assertUnique(
		data.readingSessions.map((s) => s.id),
		'readingSessions',
	)
	assertUnique(
		data.readingProgressEvents.map((e) => e.id),
		'readingProgressEvents',
	)
	assertUnique(
		data.readingNotes.map((n) => n.id),
		'readingNotes',
	)
	assertUnique(
		data.readingGoals.map((g) => g.id),
		'readingGoals',
	)
	const junctions = data.libraryEntryShelves.map(
		(j) => `${j.libraryEntryId}::${j.shelfId}`,
	)
	assertUnique(junctions, 'libraryEntryShelves')
}

function assertUnique (ids: string[], label: string): void {
	const set = new Set<string>()
	for (const id of ids) {
		if (set.has(id)) {
			throw new BackupValidationError(
				'DUPLICATE_ID',
				`Дублирующийся id в ${label}`,
			)
		}
		set.add(id)
	}
}

function validateForeignKeys (data: BackupData): void {
	const bookIds = new Set(data.books.map((b) => b.id))
	const entryIds = new Set(data.libraryEntries.map((e) => e.id))
	const shelfIds = new Set(data.shelves.map((s) => s.id))
	const sessionIds = new Set(data.readingSessions.map((s) => s.id))

	for (const entry of data.libraryEntries) {
		if (!bookIds.has(entry.bookId)) {
			throw new BackupValidationError(
				'BROKEN_FK',
				`library_entry ${entry.id} → book`,
			)
		}
	}
	for (const session of data.readingSessions) {
		if (!entryIds.has(session.libraryEntryId)) {
			throw new BackupValidationError(
				'BROKEN_FK',
				`session ${session.id} → entry`,
			)
		}
	}
	for (const note of data.readingNotes) {
		if (!entryIds.has(note.libraryEntryId)) {
			throw new BackupValidationError(
				'BROKEN_FK',
				`note ${note.id} → entry`,
			)
		}
		if (
			note.readingSessionId != null &&
			!sessionIds.has(note.readingSessionId)
		) {
			throw new BackupValidationError(
				'BROKEN_FK',
				`note ${note.id} → session`,
			)
		}
	}
	for (const ev of data.readingProgressEvents) {
		if (!entryIds.has(ev.libraryEntryId)) {
			throw new BackupValidationError(
				'BROKEN_FK',
				`event ${ev.id} → entry`,
			)
		}
		if (
			ev.readingSessionId != null &&
			!sessionIds.has(ev.readingSessionId)
		) {
			throw new BackupValidationError(
				'BROKEN_FK',
				`event ${ev.id} → session`,
			)
		}
	}
	for (const j of data.libraryEntryShelves) {
		if (!entryIds.has(j.libraryEntryId) || !shelfIds.has(j.shelfId)) {
			throw new BackupValidationError(
				'BROKEN_FK',
				`junction ${j.libraryEntryId}/${j.shelfId}`,
			)
		}
	}
}
