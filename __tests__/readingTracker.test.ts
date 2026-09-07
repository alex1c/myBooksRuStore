/**
 * Phase 4 — reading tracker / sessions / quick progress tests.
 */

import { applyMigrations, getSchemaVersion } from '@/db/migrations/applyMigrations'
import {
	createBook,
	createLibraryEntry,
	getActiveSession,
	getLibraryEntryById,
	getProgressEventById,
	listProgressEventsForEntry,
} from '@/db/repositories'
import {
	ActiveSessionConflictError,
	applyQuickProgress,
	cancelReadingSession,
	continueReadingBook,
	finishReadingSession,
	getActiveSessionBundle,
	isCompletionReached,
	listBookSessions,
	markBookFinished,
	reopenFinishedBook,
	startReadingSession,
	undoProgressEvent,
} from '@/domain/readingTrackerService'
import {
	durationSecondsBetween,
	elapsedSecondsFromStart,
	formatSessionTimer,
} from '@/utils/sessionTimer'
import { createTestSqlExecutor } from './helpers/testDatabase'

async function seedReadingBook (
	db: ReturnType<typeof createTestSqlExecutor>,
	opts: {
		title?: string
		currentPage?: number
		totalPages?: number
		progressMode?: 'PAGES' | 'PERCENT' | 'TIME'
		currentPercent?: number
		audioPositionSeconds?: number
		audioDurationSeconds?: number
		status?: 'READING' | 'WANT_TO_READ' | 'PAUSED' | 'ABANDONED' | 'FINISHED'
	} = {},
) {
	await applyMigrations(db)
	const book = await createBook(db, {
		title: opts.title ?? 'Дюна',
		authorText: 'Фрэнк Герберт',
	})
	const entry = await createLibraryEntry(db, {
		bookId: book.id,
		status: opts.status ?? 'READING',
		progressMode: opts.progressMode ?? 'PAGES',
		currentPage: opts.currentPage ?? 100,
		totalPages: opts.totalPages ?? 300,
		currentPercent: opts.currentPercent ?? null,
		audioPositionSeconds: opts.audioPositionSeconds ?? null,
		audioDurationSeconds: opts.audioDurationSeconds ?? null,
	})
	return { book, entry }
}

describe('session timer helpers', () => {
	it('formats under and over one hour', () => {
		expect(formatSessionTimer(37 * 60 + 12)).toBe('37:12')
		expect(formatSessionTimer(3600 + 7 * 60 + 3)).toBe('1:07:03')
	})

	it('never returns negative elapsed or duration', () => {
		expect(elapsedSecondsFromStart('2099-01-01T00:00:00.000Z', Date.parse('2020-01-01T00:00:00.000Z'))).toBe(0)
		expect(
			durationSecondsBetween(
				'2026-09-06T12:00:00.000Z',
				'2026-09-06T11:00:00.000Z',
			),
		).toBe(0)
	})
})

describe('reading tracker — sessions', () => {
	it('starts an active session capturing start progress', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seedReadingBook(db, { currentPage: 100, totalPages: 300 })

		const bundle = await startReadingSession(
			db,
			entry.id,
			'2026-09-06T10:00:00.000Z',
		)

		expect(bundle.session.endedAt).toBeNull()
		expect(bundle.session.durationSeconds).toBeNull()
		expect(bundle.session.startPage).toBe(100)
		expect(bundle.session.startedAt).toBe('2026-09-06T10:00:00.000Z')

		const active = await getActiveSession(db)
		expect(active?.id).toBe(bundle.session.id)
	})

	it('allows only one active session', async () => {
		const db = createTestSqlExecutor()
		const first = await seedReadingBook(db, { title: 'Дюна' })
		const book2 = await createBook(db, { title: 'Мастер', authorText: 'Булгаков' })
		const entry2 = await createLibraryEntry(db, {
			bookId: book2.id,
			status: 'READING',
			currentPage: 10,
			totalPages: 100,
		})

		await startReadingSession(db, first.entry.id, '2026-09-06T10:00:00.000Z')

		await expect(
			startReadingSession(db, entry2.id, '2026-09-06T10:05:00.000Z'),
		).rejects.toBeInstanceOf(ActiveSessionConflictError)

		const active = await getActiveSession(db)
		expect(active?.libraryEntryId).toBe(first.entry.id)
	})

	it('finishes session atomically with duration and progress', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seedReadingBook(db, { currentPage: 100, totalPages: 300 })
		const started = await startReadingSession(
			db,
			entry.id,
			'2026-09-06T10:00:00.000Z',
		)

		const result = await finishReadingSession(db, {
			sessionId: started.session.id,
			endedAt: '2026-09-06T10:37:00.000Z',
			endPage: 125,
		})

		expect(result.session.endedAt).toBe('2026-09-06T10:37:00.000Z')
		expect(result.session.durationSeconds).toBe(37 * 60)
		expect(result.session.startPage).toBe(100)
		expect(result.session.endPage).toBe(125)
		expect(result.item.entry.currentPage).toBe(125)
		expect(result.deltaLabel).toContain('25')

		expect(await getActiveSession(db)).toBeNull()
	})

	it('cancel removes active session without changing progress', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seedReadingBook(db, { currentPage: 100 })
		const started = await startReadingSession(db, entry.id)
		await cancelReadingSession(db, started.session.id)

		expect(await getActiveSession(db)).toBeNull()
		const after = await getLibraryEntryById(db, entry.id)
		expect(after?.currentPage).toBe(100)
	})

	it('recovers unfinished session after repository re-init', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seedReadingBook(db, { currentPage: 50 })
		const started = await startReadingSession(
			db,
			entry.id,
			'2026-09-06T08:00:00.000Z',
		)

		// Simulate app restart: new service call against the same persisted DB.
		const recovered = await getActiveSessionBundle(db)
		expect(recovered?.session.id).toBe(started.session.id)
		expect(recovered?.session.endedAt).toBeNull()
		expect(recovered?.item.entry.id).toBe(entry.id)
		expect(recovered?.session.startedAt).toBe('2026-09-06T08:00:00.000Z')
	})

	it('sequential race-like starts keep a single active session', async () => {
		const db = createTestSqlExecutor()
		const a = await seedReadingBook(db, { title: 'A' })
		const bookB = await createBook(db, { title: 'B', authorText: 'X' })
		const b = await createLibraryEntry(db, {
			bookId: bookB.id,
			status: 'READING',
			currentPage: 1,
			totalPages: 10,
		})

		await startReadingSession(db, a.entry.id)
		let conflict = 0
		try {
			await startReadingSession(db, b.id)
		} catch (error) {
			if (error instanceof ActiveSessionConflictError) {
				conflict += 1
			} else {
				throw error
			}
		}
		expect(conflict).toBe(1)
		const all = await db.getAllAsync<{ id: string }>(
			`SELECT id FROM reading_sessions WHERE ended_at IS NULL`,
		)
		expect(all).toHaveLength(1)
	})
})

describe('reading tracker — progress modes', () => {
	it('PAGES finish delta and total validation', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seedReadingBook(db, {
			currentPage: 100,
			totalPages: 120,
		})
		const started = await startReadingSession(db, entry.id, '2026-09-06T10:00:00.000Z')
		const result = await finishReadingSession(db, {
			sessionId: started.session.id,
			endedAt: '2026-09-06T10:10:00.000Z',
			endPage: 125,
		})
		// Soft clamp to total on finish
		expect(result.item.entry.currentPage).toBe(120)
		expect(result.session.endPage).toBe(120)
	})

	it('PERCENT 40 → 55 and max 100', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seedReadingBook(db, {
			progressMode: 'PERCENT',
			currentPercent: 40,
			currentPage: null,
			totalPages: null,
		})
		const started = await startReadingSession(db, entry.id, '2026-09-06T10:00:00.000Z')
		const result = await finishReadingSession(db, {
			sessionId: started.session.id,
			endedAt: '2026-09-06T10:31:00.000Z',
			endPercent: 55,
		})
		expect(result.session.startPercent).toBe(40)
		expect(result.session.endPercent).toBe(55)
		expect(result.item.entry.currentPercent).toBe(55)

		const over = await applyQuickProgress(db, entry.id, {
			kind: 'percent',
			delta: 100,
		})
		expect(over.entry.currentPercent).toBe(100)
	})

	it('TIME 3600 → 5400 with duration validation', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seedReadingBook(db, {
			progressMode: 'TIME',
			currentPage: null,
			totalPages: null,
			audioPositionSeconds: 3600,
			audioDurationSeconds: 7200,
		})
		const started = await startReadingSession(db, entry.id, '2026-09-06T10:00:00.000Z')
		const result = await finishReadingSession(db, {
			sessionId: started.session.id,
			endedAt: '2026-09-06T10:45:00.000Z',
			endAudioSeconds: 5400,
		})
		expect(result.session.startAudioSeconds).toBe(3600)
		expect(result.session.endAudioSeconds).toBe(5400)
		expect(result.item.entry.audioPositionSeconds).toBe(5400)

		await expect(
			applyQuickProgress(db, entry.id, {
				kind: 'setAudioSeconds',
				seconds: 9000,
			}),
		).rejects.toThrow('AUDIO_EXCEEDS_DURATION')
	})
})

describe('reading tracker — quick progress', () => {
	it('applies +1 +10 +25 pages and records events', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seedReadingBook(db, { currentPage: 100, totalPages: 500 })

		await applyQuickProgress(db, entry.id, { kind: 'pages', delta: 1 })
		await applyQuickProgress(db, entry.id, { kind: 'pages', delta: 10 })
		const last = await applyQuickProgress(db, entry.id, { kind: 'pages', delta: 25 })

		expect(last.entry.currentPage).toBe(136)
		const events = await listProgressEventsForEntry(db, entry.id)
		expect(events.length).toBeGreaterThanOrEqual(3)
		expect(events[0]?.type).toBe('QUICK_UPDATE')
	})

	it('clamps pages at total and rejects invalid exact page', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seedReadingBook(db, {
			currentPage: 295,
			totalPages: 300,
		})
		const result = await applyQuickProgress(db, entry.id, {
			kind: 'pages',
			delta: 25,
		})
		expect(result.entry.currentPage).toBe(300)

		await expect(
			applyQuickProgress(db, entry.id, { kind: 'setPages', page: 400 }),
		).rejects.toThrow('PAGE_EXCEEDS_TOTAL')
	})

	it('supports undo of quick update', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seedReadingBook(db, { currentPage: 100 })
		const updated = await applyQuickProgress(db, entry.id, {
			kind: 'pages',
			delta: 10,
		})
		expect(updated.entry.currentPage).toBe(110)

		const undone = await undoProgressEvent(db, updated.event.id)
		expect(undone.entry.currentPage).toBe(100)
		const event = await getProgressEventById(db, undone.event.id)
		expect(event?.type).toBe('UNDO')
	})
})

describe('reading tracker — finish book & status', () => {
	it('detects completion without silent status change', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seedReadingBook(db, {
			currentPage: 290,
			totalPages: 300,
		})
		const result = await applyQuickProgress(db, entry.id, {
			kind: 'pages',
			delta: 10,
		})
		expect(isCompletionReached(result.entry)).toBe(true)
		expect(result.entry.status).toBe('READING')

		const finished = await markBookFinished(db, entry.id, {
			applySuggestedProgress: true,
		})
		expect(finished.entry.status).toBe('FINISHED')
		expect(finished.entry.finishedDatePrecision).toBe('EXACT')
		expect(finished.entry.finishedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
		expect(finished.entry.currentPage).toBe(300)
	})

	it('continue reading from PAUSED and ABANDONED', async () => {
		const db = createTestSqlExecutor()
		const paused = await seedReadingBook(db, { status: 'PAUSED', title: 'P' })
		const continued = await continueReadingBook(db, paused.entry.id)
		expect(continued.entry.status).toBe('READING')

		const abandoned = await seedReadingBook(db, {
			status: 'ABANDONED',
			title: 'A',
		})
		const back = await continueReadingBook(db, abandoned.entry.id)
		expect(back.entry.status).toBe('READING')
	})

	it('reopen finished keeps sessions', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seedReadingBook(db, { currentPage: 10, totalPages: 100 })
		const started = await startReadingSession(
			db,
			entry.id,
			'2026-09-06T10:00:00.000Z',
		)
		await finishReadingSession(db, {
			sessionId: started.session.id,
			endedAt: '2026-09-06T10:20:00.000Z',
			endPage: 30,
		})
		await markBookFinished(db, entry.id)
		const reopened = await reopenFinishedBook(db, entry.id)
		expect(reopened.entry.status).toBe('READING')
		expect(reopened.entry.finishedOn).toBeNull()
		const history = await listBookSessions(db, entry.id)
		expect(history).toHaveLength(1)
		expect(history[0]?.endedAt).not.toBeNull()
	})

	it('WANT_TO_READ becomes READING on session start', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seedReadingBook(db, {
			status: 'WANT_TO_READ',
			currentPage: 0,
			totalPages: 200,
		})
		const started = await startReadingSession(db, entry.id)
		expect(started.item.entry.status).toBe('READING')
	})
})

describe('reading tracker — integration', () => {
	it('full flow: create → session → finish → reopen repo → history', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)
		expect(await getSchemaVersion(db)).toBe(5)

		const book = await createBook(db, {
			title: 'Мастер и Маргарита',
			authorText: 'Михаил Булгаков',
		})
		const entry = await createLibraryEntry(db, {
			bookId: book.id,
			status: 'READING',
			currentPage: 100,
			totalPages: 300,
		})

		const started = await startReadingSession(
			db,
			entry.id,
			'2026-09-06T18:00:00.000Z',
		)
		const finished = await finishReadingSession(db, {
			sessionId: started.session.id,
			endedAt: '2026-09-06T18:37:00.000Z',
			endPage: 135,
		})

		expect(finished.session.durationSeconds).toBe(37 * 60)
		expect(finished.session.startPage).toBe(100)
		expect(finished.session.endPage).toBe(135)
		expect(finished.item.entry.currentPage).toBe(135)

		// Re-query after "reopen" of repository layer
		const history = await listBookSessions(db, entry.id)
		expect(history).toHaveLength(1)
		expect(history[0]?.durationSeconds).toBe(37 * 60)
		expect(await getActiveSession(db)).toBeNull()
		const entryAgain = await getLibraryEntryById(db, entry.id)
		expect(entryAgain?.currentPage).toBe(135)
	})

	it('migration 004 adds progress events table and active index', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)
		expect(await getSchemaVersion(db)).toBe(5)

		const events = await db.getFirstAsync(
			`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'reading_progress_events'`,
		)
		expect(events).not.toBeNull()

		const index = await db.getFirstAsync(
			`SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_reading_sessions_one_active'`,
		)
		expect(index).not.toBeNull()
	})
})
