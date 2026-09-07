/**
 * Phase 9 — backup / restore round-trip, validation, CSV/PDF helpers.
 */

import { applyMigrations } from '@/db/migrations/applyMigrations'
import {
	archiveBook,
	archiveLibraryEntry,
	archiveReadingGoal,
	archiveShelf,
	attachEntryToShelf,
	createBook,
	createLibraryEntry,
	createProgressEvent,
	createReadingGoal,
	createReadingNote,
	createReadingSession,
	createShelf,
	ensureAppSettings,
	startActiveSession,
} from '@/db/repositories'
import { setThemePreference } from '@/db/repositories/settings'
import {
	createBackupZipBytes,
	packBackupZip,
	restoreBackupArchive,
	restoreFromZipBytes,
	snapshotUserData,
	unpackBackupZip,
} from '@/domain/backup/backupService'
import { collectBackupArchive } from '@/domain/backup/collectBackupData'
import { BACKUP_FORMAT_ID, BACKUP_FORMAT_VERSION } from '@/domain/backup/constants'
import { canonicalDataJson, sha256Hex } from '@/domain/backup/checksum'
import type { BackupArchive } from '@/domain/backup/types'
import { BackupValidationError } from '@/domain/backup/types'
import { validateBackupArchive } from '@/domain/backup/validateBackup'
import {
	buildLibraryCsv,
	escapeCsvCell,
} from '@/domain/export/csvExport'
import {
	buildLibraryPdfHtml,
	escapeHtml,
} from '@/domain/export/pdfExport'
import { createTestSqlExecutor } from './helpers/testDatabase'

async function seedRoundTripDataset (
	db: ReturnType<typeof createTestSqlExecutor>,
) {
	await applyMigrations(db)
	await ensureAppSettings(db)
	await setThemePreference(db, 'dark')

	const paper = await createBook(db, {
		title: 'Дюна',
		authorText: 'Фрэнк Герберт',
		isbn13: '9780441172719',
		remoteCoverUrl: 'https://example.com/dune.jpg',
	})
	const ebook = await createBook(db, {
		title: '1984',
		authorText: 'Оруэлл',
		pageCount: 328,
	})
	const yearBook = await createBook(db, {
		title: 'Год без даты',
		authorText: 'Автор',
	})
	const unknownBook = await createBook(db, {
		title: 'Когда-то',
		authorText: 'Неизвестно',
	})
	const audio = await createBook(db, {
		title: 'Аудиокнига',
		authorText: 'Диктор',
	})
	const archivedBook = await createBook(db, {
		title: 'Архив',
		authorText: 'Старый',
	})

	const reading = await createLibraryEntry(db, {
		bookId: paper.id,
		status: 'READING',
		format: 'PAPER',
		progressMode: 'PAGES',
		currentPage: 42,
		totalPages: 600,
		reviewText: 'Отзыв с "кавычками"; и переносом\nстроки',
	})
	const finishedExact = await createLibraryEntry(db, {
		bookId: ebook.id,
		status: 'FINISHED',
		format: 'EBOOK',
		progressMode: 'PAGES',
		currentPage: 328,
		totalPages: 328,
		finishedDatePrecision: 'EXACT',
		finishedOn: '2026-02-10',
		rating: 4.5,
	})
	await createLibraryEntry(db, {
		bookId: yearBook.id,
		status: 'FINISHED',
		format: 'PAPER',
		progressMode: 'PAGES',
		finishedDatePrecision: 'YEAR',
		finishedYear: 2026,
	})
	await createLibraryEntry(db, {
		bookId: unknownBook.id,
		status: 'FINISHED',
		format: 'PAPER',
		progressMode: 'PAGES',
		finishedDatePrecision: 'UNKNOWN',
	})
	await createLibraryEntry(db, {
		bookId: audio.id,
		status: 'READING',
		format: 'AUDIOBOOK',
		progressMode: 'TIME',
		audioPositionSeconds: 120,
		audioDurationSeconds: 36000,
	})
	const archivedEntry = await createLibraryEntry(db, {
		bookId: archivedBook.id,
		status: 'WANT_TO_READ',
		format: 'PAPER',
		progressMode: 'PAGES',
	})
	await archiveLibraryEntry(db, archivedEntry.id)
	await archiveBook(db, archivedBook.id)

	const shelf = await createShelf(db, 'Любимые')
	const archivedShelf = await createShelf(db, 'Старое')
	await archiveShelf(db, archivedShelf.id)
	await attachEntryToShelf(db, reading.id, shelf.id)
	await attachEntryToShelf(db, finishedExact.id, shelf.id)

	const completed = await createReadingSession(db, {
		libraryEntryId: reading.id,
		startedAt: new Date(2026, 5, 1, 12, 0, 0).toISOString(),
		endedAt: new Date(2026, 5, 1, 12, 40, 0).toISOString(),
		durationSeconds: 40 * 60,
		startPage: 10,
		endPage: 40,
	})
	await startActiveSession(db, {
		libraryEntryId: reading.id,
		startedAt: new Date().toISOString(),
		startPage: 42,
	})

	await createProgressEvent(db, {
		libraryEntryId: reading.id,
		readingSessionId: completed.id,
		type: 'SESSION_END',
		previousPage: 10,
		newPage: 40,
	})
	await createProgressEvent(db, {
		libraryEntryId: reading.id,
		type: 'QUICK_UPDATE',
		previousPage: 40,
		newPage: 42,
	})

	await createReadingNote(db, {
		libraryEntryId: reading.id,
		readingSessionId: completed.id,
		type: 'QUOTE',
		text: 'Цитата со сессией',
		page: 20,
	})
	await createReadingNote(db, {
		libraryEntryId: reading.id,
		type: 'THOUGHT',
		text: 'Мысль без сессии',
	})
	await createReadingNote(db, {
		libraryEntryId: finishedExact.id,
		type: 'NOTE',
		text: 'Заметка',
	})

	const goal = await createReadingGoal(db, {
		type: 'PAGES',
		period: 'DAY',
		targetValue: 20,
		startsOn: '2026-01-01',
	})
	const archivedGoal = await createReadingGoal(db, {
		type: 'BOOKS',
		period: 'YEAR',
		targetValue: 12,
		startsOn: '2025-01-01',
	})
	await archiveReadingGoal(db, archivedGoal.id)

	return {
		reading,
		finishedExact,
		completed,
		shelf,
		goal,
		paper,
	}
}

describe('backup collect + zip', () => {
	it('includes core entities, archived rows, settings, active session', async () => {
		const db = createTestSqlExecutor()
		await seedRoundTripDataset(db)
		const archive = await collectBackupArchive(db)
		expect(archive.manifest.format).toBe(BACKUP_FORMAT_ID)
		expect(archive.manifest.formatVersion).toBe(BACKUP_FORMAT_VERSION)
		expect(archive.manifest.schemaVersion).toBe(5)
		expect(archive.manifest.dataSha256).toHaveLength(64)
		expect(archive.data.books.length).toBeGreaterThanOrEqual(6)
		expect(archive.data.books.some((b) => b.archivedAt)).toBe(true)
		expect(archive.data.libraryEntries.some((e) => e.archivedAt)).toBe(true)
		expect(archive.data.shelves.some((s) => s.archivedAt)).toBe(true)
		expect(archive.data.readingGoals.some((g) => g.archivedAt)).toBe(true)
		expect(archive.data.readingSessions.some((s) => s.endedAt == null)).toBe(
			true,
		)
		expect(archive.data.settings.theme).toBe('dark')
		expect(
			archive.data.libraryEntries.some(
				(e) => e.finishedDatePrecision === 'YEAR',
			),
		).toBe(true)
		expect(
			archive.data.libraryEntries.some(
				(e) => e.finishedDatePrecision === 'UNKNOWN',
			),
		).toBe(true)

		const bytes = await packBackupZip(archive)
		const again = await unpackBackupZip(bytes)
		expect(again.data.books.length).toBe(archive.data.books.length)
		expect(again.manifest.dataSha256).toBe(archive.manifest.dataSha256)
	})
})

describe('backup validation', () => {
	it('accepts valid archive and rejects wrong format / future / duplicates / FK', async () => {
		const db = createTestSqlExecutor()
		await seedRoundTripDataset(db)
		const archive = await collectBackupArchive(db)
		await expect(validateBackupArchive(archive)).resolves.toBeUndefined()

		await expect(
			validateBackupArchive({
				...archive,
				manifest: { ...archive.manifest, format: 'other' },
			}),
		).rejects.toBeInstanceOf(BackupValidationError)

		await expect(
			validateBackupArchive({
				...archive,
				manifest: { ...archive.manifest, formatVersion: 99 },
			}),
		).rejects.toMatchObject({ code: 'UNSUPPORTED_FUTURE_VERSION' })

		const dup = structuredClone(archive) as BackupArchive
		dup.data.books.push({ ...dup.data.books[0]! })
		dup.manifest.counts.books = dup.data.books.length
		dup.manifest.dataSha256 = await sha256Hex(canonicalDataJson(dup.data))
		await expect(validateBackupArchive(dup)).rejects.toMatchObject({
			code: 'DUPLICATE_ID',
		})

		const broken = structuredClone(archive) as BackupArchive
		broken.data.libraryEntries[0]!.bookId = 'missing-book'
		broken.manifest.dataSha256 = await sha256Hex(
			canonicalDataJson(broken.data),
		)
		await expect(validateBackupArchive(broken)).rejects.toMatchObject({
			code: 'BROKEN_FK',
		})
	})
})

describe('backup round trip', () => {
	it('SOURCE == RESTORED for IDs, relations, archive flags, precision, active session', async () => {
		const db = createTestSqlExecutor()
		const seeded = await seedRoundTripDataset(db)
		const coverStore = new Map<string, Uint8Array>()
		coverStore.set(seeded.paper.id, new Uint8Array([1, 2, 3, 4]))

		const before = await snapshotUserData(db)
		const { bytes } = await createBackupZipBytes(db, {
			async readLocalCover (bookId) {
				return coverStore.get(bookId) ?? null
			},
		})

		// Clear and restore into the same DB
		const restoredPaths = new Map<string, string>()
		await restoreFromZipBytes(db, bytes, {
			async writeCover (bookId, _rel, bytesIn) {
				const path = `file:///restored/covers/${bookId}.jpg`
				restoredPaths.set(bookId, path)
				coverStore.set(bookId, bytesIn)
				return path
			},
		})

		const after = await snapshotUserData(db)
		expect(after).toEqual(before)

		// Explicit relationship checks
		const noteWithSession = after.readingNotes.find(
			(n: { text: string }) => n.text === 'Цитата со сессией',
		) as { readingSessionId: string | null }
		expect(noteWithSession.readingSessionId).toBe(seeded.completed.id)

		const noteWithout = after.readingNotes.find(
			(n: { text: string }) => n.text === 'Мысль без сессии',
		) as { readingSessionId: string | null }
		expect(noteWithout.readingSessionId).toBeNull()

		expect(
			after.libraryEntryShelves.some(
				(j: { libraryEntryId: string; shelfId: string }) =>
					j.libraryEntryId === seeded.reading.id &&
					j.shelfId === seeded.shelf.id,
			),
		).toBe(true)

		expect(
			after.books.some(
				(b: { id: string; archivedAt: string | null }) =>
					b.archivedAt != null,
			),
		).toBe(true)
		expect(
			after.readingSessions.some(
				(s: { endedAt: string | null }) => s.endedAt == null,
			),
		).toBe(true)
		expect(
			after.libraryEntries.some(
				(e: { finishedDatePrecision: string | null }) =>
					e.finishedDatePrecision === 'EXACT',
			),
		).toBe(true)
		expect(after.readingProgressEvents.length).toBe(
			before.readingProgressEvents.length,
		)
		expect(restoredPaths.get(seeded.paper.id)).toContain(seeded.paper.id)

		const book = await db.getFirstAsync<{ cover_uri: string | null; remote_cover_url: string | null }>(
			`SELECT cover_uri, remote_cover_url FROM books WHERE id = ?`,
			[seeded.paper.id],
		)
		expect(book?.cover_uri).toContain(seeded.paper.id)
		expect(book?.remote_cover_url).toBe('https://example.com/dune.jpg')
	})

	it('missing cover asset does not block restore', async () => {
		const db = createTestSqlExecutor()
		await seedRoundTripDataset(db)
		const archive = await collectBackupArchive(db)
		archive.data.books[0]!.coverAsset = 'covers/missing.jpg'
		// no bytes in archive.covers
		archive.manifest.dataSha256 = await sha256Hex(
			canonicalDataJson(archive.data),
		)
		await expect(
			restoreBackupArchive(db, archive, {
				async writeCover () {
					return null
				},
			}),
		).resolves.toBeUndefined()
	})
})

describe('restore failure safety', () => {
	it('keeps original data when transaction throws after clear', async () => {
		const db = createTestSqlExecutor()
		await seedRoundTripDataset(db)
		const before = await snapshotUserData(db)

		await expect(
			db.withTransactionAsync(async () => {
				await db.runAsync(`DELETE FROM library_entry_shelves`)
				await db.runAsync(`DELETE FROM reading_notes`)
				await db.runAsync(`DELETE FROM reading_progress_events`)
				await db.runAsync(`DELETE FROM reading_sessions`)
				await db.runAsync(`DELETE FROM library_entries`)
				await db.runAsync(`DELETE FROM books`)
				throw new Error('SIMULATED_RESTORE_FAILURE')
			}),
		).rejects.toThrow('SIMULATED_RESTORE_FAILURE')

		const after = await snapshotUserData(db)
		expect(after).toEqual(before)
	})

	it('passes foreign_key_check after successful restore', async () => {
		const db = createTestSqlExecutor()
		await seedRoundTripDataset(db)
		const { bytes } = await createBackupZipBytes(db)
		await restoreFromZipBytes(db, bytes)
		const violations = await db.getAllAsync(`PRAGMA foreign_key_check`)
		expect(violations).toEqual([])
	})
})

describe('csv export', () => {
	it('uses BOM, semicolon, escaping, precision columns', async () => {
		expect(escapeCsvCell('a;b')).toBe('"a;b"')
		expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""')

		const db = createTestSqlExecutor()
		await seedRoundTripDataset(db)
		const csv = await buildLibraryCsv(db)
		expect(csv.startsWith('\uFEFF')).toBe(true)
		expect(csv).toContain('Название;Автор;Статус')
		expect(csv).toContain('Точность даты')
		expect(csv).toContain('Дюна')
		expect(csv).toContain('Отзыв с ""кавычками""; и переносом')
		expect(csv).not.toContain('lib_')
		expect(csv).toContain('Точная дата')
		expect(csv).toContain('Только год')
	})
})

describe('pdf html', () => {
	it('escapes user content and uses Russian labels', async () => {
		expect(escapeHtml('a<b>&"')).toBe('a&lt;b&gt;&amp;&quot;')
		const db = createTestSqlExecutor()
		await seedRoundTripDataset(db)
		const html = await buildLibraryPdfHtml(db, 'ALL')
		expect(html).toContain('Моя библиотека')
		expect(html).toContain('Прочитано')
		expect(html).toContain('Дюна')
		expect(html).not.toContain('<script')
		const evil = await createBook(db, {
			title: '<script>alert(1)</script>',
			authorText: 'X',
		})
		await createLibraryEntry(db, {
			bookId: evil.id,
			status: 'WANT_TO_READ',
			format: 'PAPER',
			progressMode: 'PAGES',
		})
		const html2 = await buildLibraryPdfHtml(db, 'WANT_TO_READ')
		expect(html2).toContain('&lt;script&gt;')
		expect(html2).not.toContain('<script>alert')
	})
})

describe('large backup sanity', () => {
	it('serializes and restores hundreds of books without hanging', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)
		await ensureAppSettings(db)
		const started = Date.now()
		for (let i = 0; i < 300; i += 1) {
			const book = await createBook(db, {
				title: `Book ${i}`,
				authorText: `Author ${i % 10}`,
			})
			const entry = await createLibraryEntry(db, {
				bookId: book.id,
				status: i % 2 === 0 ? 'FINISHED' : 'READING',
				format: 'PAPER',
				progressMode: 'PAGES',
				currentPage: i,
				totalPages: 400,
				finishedDatePrecision: i % 2 === 0 ? 'EXACT' : null,
				finishedOn: i % 2 === 0 ? '2026-01-15' : null,
			})
			await createReadingSession(db, {
				libraryEntryId: entry.id,
				startedAt: new Date(2026, 0, 1 + (i % 28), 10, 0, 0).toISOString(),
				endedAt: new Date(2026, 0, 1 + (i % 28), 10, 20, 0).toISOString(),
				durationSeconds: 20 * 60,
			})
			if (i % 3 === 0) {
				await createReadingNote(db, {
					libraryEntryId: entry.id,
					type: 'NOTE',
					text: `n${i}`,
				})
			}
		}
		const { bytes } = await createBackupZipBytes(db)
		await restoreFromZipBytes(db, bytes)
		const count = await db.getFirstAsync<{ c: number }>(
			`SELECT COUNT(*) AS c FROM books`,
		)
		expect(count?.c).toBe(300)
		expect(Date.now() - started).toBeLessThan(90_000)
	}, 120_000)
})
