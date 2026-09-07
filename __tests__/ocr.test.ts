/**
 * Phase 11 — quote OCR normalization, mock engine, note integration.
 */

import { applyMigrations } from '@/db/migrations/applyMigrations'
import {
	createBook,
	createLibraryEntry,
	ensureAppSettings,
	getReadingNoteById,
} from '@/db/repositories'
import {
	createNote,
	getDiaryTimeline,
	listNotesForBook,
} from '@/domain/diaryService'
import { scanCopy, ocrCopy } from '@/constants/copy'
import {
	clearPendingOcrDraft,
	createFailingOcrEngine,
	createMockOcrEngine,
	joinOcrLines,
	normalizeOcrText,
	OcrError,
	recognizeText,
	resolveOcrEditorText,
	setOcrEngine,
	setPendingOcrDraft,
	takePendingOcrDraft,
} from '@/domain/ocr/ocrService'
import { OCR_ENGINE_INFO } from '@/domain/ocr/engineInfo'
import {
	finishReadingSession,
	getActiveSessionBundle,
	startReadingSession,
} from '@/domain/readingTrackerService'
import { elapsedSecondsFromStart } from '@/utils/sessionTimer'
import { createTestSqlExecutor } from './helpers/testDatabase'

async function emptyDb () {
	const db = createTestSqlExecutor()
	await applyMigrations(db)
	await ensureAppSettings(db)
	return db
}

beforeEach(() => {
	clearPendingOcrDraft()
	setOcrEngine(null)
})

describe('OCR engine docs', () => {
	it('documents local Cyrillic-capable engine choice', () => {
		expect(OCR_ENGINE_INFO.russianSupport).toBe(true)
		expect(OCR_ENGINE_INFO.cloudPhotoUpload).toBe(false)
		expect(OCR_ENGINE_INFO.requiresNativeRebuild).toBe(true)
		expect(OCR_ENGINE_INFO.packageName).toBe('react-native-executorch')
	})
})

describe('OCR normalization', () => {
	it('normalizes Russian multiline, whitespace, punctuation; keeps hyphens', () => {
		const raw =
			'  Никогда и ничего не просите!  \n\n\n' +
			'Никогда и ничего,\tособенно у тех,\n' +
			'кто сильнее вас.  \r\n' +
			'сло-\nво'
		const out = normalizeOcrText(raw)
		expect(out).toContain('Никогда и ничего не просите!')
		expect(out).toContain('кто сильнее вас.')
		expect(out).toContain('сло-')
		expect(out).toContain('во')
		expect(out).not.toMatch(/ {2,}/)
		expect(out.startsWith(' ')).toBe(false)
	})

	it('normalizes English multiline and empty', () => {
		expect(normalizeOcrText('')).toBe('')
		expect(normalizeOcrText('  Hello   world  \n\n  Next  ')).toBe(
			'Hello world\n\nNext',
		)
		expect(joinOcrLines('Line one\nLine two\n\nPara')).toBe(
			'Line one Line two\n\nPara',
		)
	})

	it('preserves existing draft unless explicitly replaced/appended', () => {
		expect(resolveOcrEditorText('', 'OCR')).toBe('OCR')
		expect(resolveOcrEditorText('Draft', 'OCR', 'replace')).toBe('OCR')
		expect(resolveOcrEditorText('Draft', 'OCR', 'append')).toBe(
			'Draft\n\nOCR',
		)
	})
})

describe('OCR → quote integration', () => {
	it('saves edited text as QUOTE with page + active session', async () => {
		const db = await emptyDb()
		const book = await createBook(db, {
			title: 'Мастер и Маргарита',
			authorText: 'Михаил Булгаков',
		})
		const entry = await createLibraryEntry(db, {
			bookId: book.id,
			status: 'READING',
			format: 'PAPER',
			progressMode: 'PAGES',
			currentPage: 180,
			totalPages: 400,
		})
		const started = await startReadingSession(db, entry.id)
		const startedAt = started.session.startedAt

		const rawOcr =
			'Никогда и ничего не просите!\nНикогда и ничего, особенно у тех,\nкто сильнее вас.'
		setOcrEngine(
			createMockOcrEngine(async () => {
				await new Promise((r) => setTimeout(r, 30))
				return rawOcr
			}),
		)

		const recognized = await recognizeText('file:///fake-quote.jpg')
		const edited =
			'Никогда и ничего не просите! Никогда и ничего, особенно у тех, кто сильнее вас.'

		expect(recognized.fullText).not.toBe(edited)

		const note = await createNote(db, {
			libraryEntryId: entry.id,
			type: 'QUOTE',
			text: edited,
			readingSessionId: started.session.id,
			page: 180,
		})

		expect(note.note.type).toBe('QUOTE')
		expect(note.note.text).toBe(edited)
		expect(note.note.page).toBe(180)
		expect(note.note.readingSessionId).toBe(started.session.id)

		const bundle = await getActiveSessionBundle(db)
		expect(bundle?.session.id).toBe(started.session.id)
		expect(bundle?.session.startedAt).toBe(startedAt)
		expect(
			elapsedSecondsFromStart(startedAt, Date.now()),
		).toBeGreaterThanOrEqual(0)

		await finishReadingSession(db, {
			sessionId: started.session.id,
		})
		const timeline = await getDiaryTimeline(db, { limit: 20 })
		const texts = timeline.items.map((i) =>
			i.kind === 'note' ? i.note.text : null,
		)
		expect(texts).toContain(edited)

		const notes = await listNotesForBook(db, entry.id)
		expect(notes).toHaveLength(1)
	})

	it('rejects cross-book session link', async () => {
		const db = await emptyDb()
		const a = await createBook(db, { title: 'A', authorText: 'A' })
		const b = await createBook(db, { title: 'B', authorText: 'B' })
		const entryA = await createLibraryEntry(db, {
			bookId: a.id,
			status: 'READING',
			format: 'PAPER',
			progressMode: 'PAGES',
			currentPage: 1,
			totalPages: 10,
		})
		const entryB = await createLibraryEntry(db, {
			bookId: b.id,
			status: 'READING',
			format: 'PAPER',
			progressMode: 'PAGES',
			currentPage: 1,
			totalPages: 10,
		})
		const sessionA = await startReadingSession(db, entryA.id)
		await expect(
			createNote(db, {
				libraryEntryId: entryB.id,
				type: 'QUOTE',
				text: 'Чужая сессия',
				readingSessionId: sessionA.session.id,
			}),
		).rejects.toThrow('SESSION_ENTRY_MISMATCH')
	})

	it('empty / failed OCR does not create notes', async () => {
		const db = await emptyDb()
		const book = await createBook(db, { title: 'T', authorText: 'A' })
		const entry = await createLibraryEntry(db, {
			bookId: book.id,
			status: 'READING',
			format: 'PAPER',
			progressMode: 'PAGES',
		})

		setOcrEngine(createMockOcrEngine(() => '   \n  '))
		await expect(recognizeText('file:///empty.jpg')).rejects.toBeInstanceOf(
			OcrError,
		)

		setOcrEngine(createFailingOcrEngine())
		await expect(recognizeText('file:///fail.jpg')).rejects.toMatchObject({
			kind: 'FAILED',
		})

		const notes = await listNotesForBook(db, entry.id)
		expect(notes).toHaveLength(0)
	})

	it('invalid page is rejected by createNote', async () => {
		const db = await emptyDb()
		const book = await createBook(db, { title: 'T', authorText: 'A' })
		const entry = await createLibraryEntry(db, {
			bookId: book.id,
			status: 'READING',
			format: 'PAPER',
			progressMode: 'PAGES',
			currentPage: 10,
			totalPages: 50,
		})
		await expect(
			createNote(db, {
				libraryEntryId: entry.id,
				type: 'QUOTE',
				text: 'Цитата',
				page: 999,
			}),
		).rejects.toThrow(/INVALID_NOTE/)
	})
})

describe('OCR draft bridge', () => {
	it('does not silently drop existing draft text', () => {
		setPendingOcrDraft({
			entryId: 'lib_1',
			sessionId: null,
			returnTo: 'editor',
			pageHint: '12',
			existingDraft: 'Мой черновик',
			confirmedText: 'OCR текст',
			applyMode: 'append',
		})
		const taken = takePendingOcrDraft()
		expect(taken?.existingDraft).toBe('Мой черновик')
		expect(
			resolveOcrEditorText(
				taken!.existingDraft,
				taken!.confirmedText!,
				taken!.applyMode,
			),
		).toBe('Мой черновик\n\nOCR текст')
	})
})

describe('timer continuity during OCR delay', () => {
	it('keeps startedAt unchanged while OCR takes simulated time', async () => {
		const db = await emptyDb()
		const book = await createBook(db, { title: 'T', authorText: 'A' })
		const entry = await createLibraryEntry(db, {
			bookId: book.id,
			status: 'READING',
			format: 'PAPER',
			progressMode: 'PAGES',
			currentPage: 5,
			totalPages: 100,
		})
		const started = await startReadingSession(db, entry.id)
		const startedAt = started.session.startedAt

		setOcrEngine(
			createMockOcrEngine(async () => {
				await new Promise((r) => setTimeout(r, 50))
				return 'Цитата после паузы OCR'
			}),
		)
		await recognizeText('file:///slow.jpg')

		const bundle = await getActiveSessionBundle(db)
		expect(bundle?.session.startedAt).toBe(startedAt)
		expect(bundle?.elapsedSeconds).toBeGreaterThanOrEqual(
			elapsedSecondsFromStart(startedAt, Date.now()) - 1,
		)

		const note = await createNote(db, {
			libraryEntryId: entry.id,
			type: 'QUOTE',
			text: 'Цитата после паузы OCR',
			readingSessionId: started.session.id,
			page: 5,
		})
		const stored = await getReadingNoteById(db, note.note.id)
		expect(stored?.readingSessionId).toBe(started.session.id)
	})
})

describe('ISBN scanner regression markers', () => {
	it('keeps barcode-only scan copy distinct from OCR quote copy', () => {
		expect(scanCopy.title).toMatch(/ISBN/i)
		expect(ocrCopy.scanTitle).toMatch(/цитат/i)
		expect(ocrCopy.privacy).toMatch(/устройств/i)
		expect(scanCopy.permissionExplain).toMatch(/штрихкод|цитат/i)
	})
})
