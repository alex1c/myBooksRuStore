/**
 * Phase 5 — reading notes + diary timeline tests.
 */

import { applyMigrations } from '@/db/migrations/applyMigrations'
import {
	archiveLibraryEntry,
	createBook,
	createLibraryEntry,
	getReadingNoteById,
} from '@/db/repositories'
import {
	createNote,
	deleteNote,
	getDiaryTimeline,
	listNotesForBook,
	updateNote,
} from '@/domain/diaryService'
import {
	validateNoteLocation,
	validateNoteText,
} from '@/domain/noteValidation'
import {
	deleteCompletedSession,
	finishReadingSession,
	startReadingSession,
} from '@/domain/readingTrackerService'
import {
	formatDiaryDayTitle,
	toLocalDayKey,
} from '@/utils/diaryDates'
import { createTestSqlExecutor } from './helpers/testDatabase'

async function seedBook (
	db: ReturnType<typeof createTestSqlExecutor>,
	opts: {
		title?: string
		currentPage?: number
		totalPages?: number
		status?: 'READING' | 'WANT_TO_READ'
	} = {},
) {
	await applyMigrations(db)
	const book = await createBook(db, {
		title: opts.title ?? 'Мастер и Маргарита',
		authorText: 'Михаил Булгаков',
	})
	const entry = await createLibraryEntry(db, {
		bookId: book.id,
		status: opts.status ?? 'READING',
		progressMode: 'PAGES',
		currentPage: opts.currentPage ?? 100,
		totalPages: opts.totalPages ?? 300,
	})
	return { book, entry }
}

describe('note validation', () => {
	it('rejects empty and whitespace-only text', () => {
		expect(validateNoteText('')).not.toBeNull()
		expect(validateNoteText('   \n\t  ')).not.toBeNull()
		expect(validateNoteText('  цитата  ')).toBeNull()
	})

	it('validates page / percent / audio location boundaries', () => {
		expect(
			validateNoteLocation({
				progressMode: 'PAGES',
				page: 10,
				totalPages: 100,
			}),
		).toBeNull()
		expect(
			validateNoteLocation({
				progressMode: 'PAGES',
				page: 150,
				totalPages: 100,
			}),
		).not.toBeNull()
		expect(
			validateNoteLocation({
				progressMode: 'PERCENT',
				percent: 55,
			}),
		).toBeNull()
		expect(
			validateNoteLocation({
				progressMode: 'PERCENT',
				percent: 120,
			}),
		).not.toBeNull()
		expect(
			validateNoteLocation({
				progressMode: 'TIME',
				audioPositionSeconds: 60,
				audioDurationSeconds: 120,
			}),
		).toBeNull()
		expect(
			validateNoteLocation({
				progressMode: 'TIME',
				audioPositionSeconds: 200,
				audioDurationSeconds: 120,
			}),
		).not.toBeNull()
	})
})

describe('reading notes CRUD', () => {
	it('creates QUOTE / THOUGHT / NOTE and preserves multiline text', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seedBook(db)

		const quote = await createNote(db, {
			libraryEntryId: entry.id,
			type: 'QUOTE',
			text: '  Никогда и ничего не просите\n\nособенно у тех  ',
			page: 180,
		})
		expect(quote.note.type).toBe('QUOTE')
		expect(quote.note.text).toBe(
			'Никогда и ничего не просите\n\nособенно у тех',
		)
		expect(quote.note.page).toBe(180)

		const thought = await createNote(db, {
			libraryEntryId: entry.id,
			type: 'THOUGHT',
			text: 'Интересный поворот',
		})
		expect(thought.note.type).toBe('THOUGHT')

		const note = await createNote(db, {
			libraryEntryId: entry.id,
			type: 'NOTE',
			text: 'Вернуться к этой главе',
		})
		expect(note.note.type).toBe('NOTE')

		await expect(
			createNote(db, {
				libraryEntryId: entry.id,
				type: 'QUOTE',
				text: '   ',
			}),
		).rejects.toThrow(/INVALID_NOTE|NOTE_TEXT_REQUIRED/)
	})

	it('edits note without changing createdAt', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seedBook(db)
		const created = await createNote(db, {
			libraryEntryId: entry.id,
			type: 'NOTE',
			text: 'Черновик',
		})
		const createdAt = created.note.createdAt

		// Ensure updatedAt can differ
		await new Promise((resolve) => setTimeout(resolve, 5))

		const updated = await updateNote(db, created.note.id, {
			type: 'THOUGHT',
			text: 'Готовая мысль',
			page: 12,
		})
		expect(updated.note.type).toBe('THOUGHT')
		expect(updated.note.text).toBe('Готовая мысль')
		expect(updated.note.createdAt).toBe(createdAt)
		expect(updated.note.updatedAt >= createdAt).toBe(true)
	})

	it('deletes only the note', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seedBook(db)
		const a = await createNote(db, {
			libraryEntryId: entry.id,
			type: 'QUOTE',
			text: 'A',
		})
		await createNote(db, {
			libraryEntryId: entry.id,
			type: 'NOTE',
			text: 'B',
		})
		await deleteNote(db, a.note.id)
		expect(await getReadingNoteById(db, a.note.id)).toBeNull()
		const remaining = await listNotesForBook(db, entry.id)
		expect(remaining).toHaveLength(1)
		expect(remaining[0]?.text).toBe('B')
	})

	it('keeps notes when book is archived', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seedBook(db)
		await createNote(db, {
			libraryEntryId: entry.id,
			type: 'QUOTE',
			text: 'Архивная цитата',
			page: 1,
		})
		await archiveLibraryEntry(db, entry.id)
		const notes = await listNotesForBook(db, entry.id)
		expect(notes).toHaveLength(1)
		const timeline = await getDiaryTimeline(db, { filter: 'QUOTES' })
		expect(timeline.items.some((i) => i.kind === 'note')).toBe(true)
	})
})

describe('notes + sessions', () => {
	it('links notes to session and nulls FK after session delete', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seedBook(db, { currentPage: 100, totalPages: 300 })
		const started = await startReadingSession(
			db,
			entry.id,
			'2026-09-06T18:00:00.000Z',
		)

		const quote = await createNote(db, {
			libraryEntryId: entry.id,
			type: 'QUOTE',
			text: 'Никогда и ничего не просите',
			page: 180,
			readingSessionId: started.session.id,
		})
		const thought = await createNote(db, {
			libraryEntryId: entry.id,
			type: 'THOUGHT',
			text: 'Сильная сцена',
			readingSessionId: started.session.id,
		})
		expect(quote.note.readingSessionId).toBe(started.session.id)

		await finishReadingSession(db, {
			sessionId: started.session.id,
			endedAt: '2026-09-06T18:37:00.000Z',
			endPage: 200,
		})

		const timeline = await getDiaryTimeline(db, { filter: 'ALL' })
		const kinds = timeline.items.map((i) => i.kind)
		expect(kinds).toContain('session')
		expect(kinds).toContain('note')
		expect(
			timeline.items.filter((i) => i.kind === 'note'),
		).toHaveLength(2)

		await deleteCompletedSession(db, started.session.id)

		const quoteAfter = await getReadingNoteById(db, quote.note.id)
		const thoughtAfter = await getReadingNoteById(db, thought.note.id)
		expect(quoteAfter?.readingSessionId).toBeNull()
		expect(thoughtAfter?.readingSessionId).toBeNull()
		expect(quoteAfter?.text).toBe('Никогда и ничего не просите')
	})
})

describe('note/session integrity', () => {
	it('rejects linking a note to a session from another book', async () => {
		const db = createTestSqlExecutor()
		const first = await seedBook(db, { title: 'Book A' })
		const secondBook = await createBook(db, {
			title: 'Book B',
			authorText: 'Author',
		})
		const secondEntry = await createLibraryEntry(db, {
			bookId: secondBook.id,
			status: 'READING',
			progressMode: 'PAGES',
			currentPage: 1,
			totalPages: 10,
		})
		const session = await startReadingSession(db, first.entry.id)

		await expect(
			createNote(db, {
				libraryEntryId: secondEntry.id,
				type: 'NOTE',
				text: 'Wrong book',
				readingSessionId: session.session.id,
			}),
		).rejects.toThrow('SESSION_ENTRY_MISMATCH')
	})
})

describe('diary timeline', () => {
	it('groups by local day and keeps note day after edit', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seedBook(db)

		const note = await createNote(db, {
			libraryEntryId: entry.id,
			type: 'NOTE',
			text: 'Вчерашняя мысль',
		})

		// Force created_at to a fixed past day for grouping assertions.
		await db.runAsync(
			`UPDATE reading_notes SET created_at = ?, updated_at = ? WHERE id = ?`,
			[
				'2026-09-05T20:00:00.000Z',
				'2026-09-05T20:00:00.000Z',
				note.note.id,
			],
		)

		await updateNote(db, note.note.id, { text: 'Отредактировано сегодня' })
		const reloaded = await getReadingNoteById(db, note.note.id)
		expect(reloaded?.createdAt).toBe('2026-09-05T20:00:00.000Z')
		expect(toLocalDayKey(reloaded!.createdAt)).toBe(
			toLocalDayKey('2026-09-05T20:00:00.000Z'),
		)

		const timeline = await getDiaryTimeline(db, {
			filter: 'NOTES',
			now: new Date('2026-09-07T12:00:00.000Z'),
		})
		expect(timeline.sections.length).toBeGreaterThan(0)
		expect(timeline.items[0]?.kind).toBe('note')
	})

	it('filters sessions / quotes / thoughts / notes', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seedBook(db, { currentPage: 10, totalPages: 100 })
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
		await createNote(db, {
			libraryEntryId: entry.id,
			type: 'QUOTE',
			text: 'Цитата',
		})
		await createNote(db, {
			libraryEntryId: entry.id,
			type: 'THOUGHT',
			text: 'Мысль',
		})
		await createNote(db, {
			libraryEntryId: entry.id,
			type: 'NOTE',
			text: 'Заметка',
		})

		const sessions = await getDiaryTimeline(db, { filter: 'SESSIONS' })
		expect(sessions.items.every((i) => i.kind === 'session')).toBe(true)

		const quotes = await getDiaryTimeline(db, { filter: 'QUOTES' })
		expect(
			quotes.items.every(
				(i) => i.kind === 'note' && i.note.type === 'QUOTE',
			),
		).toBe(true)

		const thoughts = await getDiaryTimeline(db, { filter: 'THOUGHTS' })
		expect(
			thoughts.items.every(
				(i) => i.kind === 'note' && i.note.type === 'THOUGHT',
			),
		).toBe(true)

		const notes = await getDiaryTimeline(db, { filter: 'NOTES' })
		expect(
			notes.items.every((i) => i.kind === 'note' && i.note.type === 'NOTE'),
		).toBe(true)
	})

	it('searches note text case-insensitively for Russian', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seedBook(db)
		await createNote(db, {
			libraryEntryId: entry.id,
			type: 'QUOTE',
			text: 'Мастер пришёл на Патриаршие',
		})
		await createNote(db, {
			libraryEntryId: entry.id,
			type: 'NOTE',
			text: 'Другая запись',
		})
		const found = await listNotesForBook(db, entry.id, {
			search: 'патриаршие',
		})
		expect(found).toHaveLength(1)
		expect(found[0]?.text).toContain('Патриаршие')
	})

	it('formats Сегодня / Вчера titles', () => {
		const now = new Date(2026, 8, 7, 12, 0, 0)
		expect(formatDiaryDayTitle('2026-09-07', now)).toBe('Сегодня')
		expect(formatDiaryDayTitle('2026-09-06', now)).toBe('Вчера')
	})
})

describe('diary integration scenario', () => {
	it('create book → session → notes → diary → delete session keeps notes', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seedBook(db, {
			title: 'Мастер и Маргарита',
			currentPage: 100,
			totalPages: 480,
		})

		const started = await startReadingSession(
			db,
			entry.id,
			'2026-09-06T19:00:00.000Z',
		)
		await createNote(db, {
			libraryEntryId: entry.id,
			type: 'QUOTE',
			text: 'Никогда и ничего не просите',
			page: 180,
			readingSessionId: started.session.id,
		})
		await createNote(db, {
			libraryEntryId: entry.id,
			type: 'THOUGHT',
			text: 'Сильный диалог',
			readingSessionId: started.session.id,
		})
		await finishReadingSession(db, {
			sessionId: started.session.id,
			endedAt: '2026-09-06T19:37:00.000Z',
			endPage: 200,
		})

		const diary = await getDiaryTimeline(db)
		const sessionItems = diary.items.filter((i) => i.kind === 'session')
		const noteItems = diary.items.filter((i) => i.kind === 'note')
		expect(sessionItems).toHaveLength(1)
		expect(noteItems).toHaveLength(2)
		expect(noteItems.every((i) => i.libraryEntryId === entry.id)).toBe(true)
		expect(sessionItems[0]?.bookTitle).toBe('Мастер и Маргарита')

		await deleteCompletedSession(db, started.session.id)
		const notes = await listNotesForBook(db, entry.id)
		expect(notes).toHaveLength(2)
		expect(notes.every((n) => n.readingSessionId == null)).toBe(true)
	})
})
