import {
	isBookFormat,
	isLibraryStatus,
	isProgressMode,
	LIBRARY_STATUSES,
	BOOK_FORMATS,
	PROGRESS_MODES,
} from '@/constants/domain'
import { isDateOnly, nowIso, toDateOnlyLocal } from '@/utils/dates'
import { createId } from '@/utils/id'

describe('ids and dates', () => {
	it('creates opaque prefixed ids', () => {
		const id = createId('book')
		expect(id.startsWith('book_')).toBe(true)
		expect(id.length).toBeGreaterThan(10)
	})

	it('produces ISO timestamps and local date-only values', () => {
		const iso = nowIso()
		expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/)
		expect(isDateOnly(toDateOnlyLocal(new Date('2026-09-06T15:00:00')))).toBe(
			true,
		)
		expect(isDateOnly('2026-13-40')).toBe(false)
	})
})

describe('domain constants coverage', () => {
	it('exposes the Phase 1 status / format / progress sets', () => {
		expect(LIBRARY_STATUSES).toEqual([
			'WANT_TO_READ',
			'READING',
			'FINISHED',
			'PAUSED',
			'ABANDONED',
		])
		expect(BOOK_FORMATS).toEqual(['PAPER', 'EBOOK', 'AUDIOBOOK'])
		expect(PROGRESS_MODES).toEqual(['PAGES', 'PERCENT', 'TIME'])
		expect(isLibraryStatus('PAUSED')).toBe(true)
		expect(isBookFormat('AUDIOBOOK')).toBe(true)
		expect(isProgressMode('TIME')).toBe(true)
	})
})
