/**
 * Phase 13 — UX polish helpers and stress fixtures.
 */

import {
	buildUxStressLibrarySeeds,
	countStressSeedsByStatus,
} from './fixtures/uxStress'
import {
	formatDateRu,
	formatDateShortRu,
	isDateOnly,
} from '@/utils/dates'
import {
	formatMinutesCount,
	formatNoteTypeCounts,
	formatPagesCount,
	formatQuotesCount,
	pluralRu,
	shouldShowStartReadingCta,
} from '@/utils/format'

describe('pluralization helpers', () => {
	it('handles 1 / 2 / 5 Russian forms', () => {
		expect(pluralRu(1, ['книга', 'книги', 'книг'])).toBe('книга')
		expect(pluralRu(2, ['книга', 'книги', 'книг'])).toBe('книги')
		expect(pluralRu(5, ['книга', 'книги', 'книг'])).toBe('книг')
		expect(pluralRu(21, ['книга', 'книги', 'книг'])).toBe('книга')
		expect(formatPagesCount(1)).toBe('1 страница')
		expect(formatPagesCount(3)).toBe('3 страницы')
		expect(formatPagesCount(11)).toBe('11 страниц')
		expect(formatMinutesCount(1)).toBe('1 минута')
		expect(formatQuotesCount(1)).toBe('1 цитата')
	})

	it('formats note type counts with correct plurals', () => {
		expect(formatNoteTypeCounts(1, 2, 5)).toBe(
			'1 цитата · 2 мысли · 5 заметок',
		)
	})
})

describe('date display helpers', () => {
	it('formats YYYY-MM-DD for users', () => {
		expect(isDateOnly('2026-09-07')).toBe(true)
		expect(formatDateShortRu('2026-09-07')).toBe('07.09.2026')
		expect(formatDateRu('2026-09-07')).toMatch(/2026/)
		expect(formatDateRu('not-a-date')).toBe('not-a-date')
	})
})

describe('Today CTA visibility', () => {
	it('hides Start reading while an active session banner is present', () => {
		expect(shouldShowStartReadingCta(false)).toBe(true)
		expect(shouldShowStartReadingCta(true)).toBe(false)
	})
})

describe('UX stress fixtures', () => {
	it('builds 1000 mixed seeds without seeding production', () => {
		const seeds = buildUxStressLibrarySeeds(1000)
		expect(seeds).toHaveLength(1000)
		expect(seeds.some((s) => s.authorText === '')).toBe(true)
		expect(seeds.some((s) => !s.hasCover)).toBe(true)
		expect(seeds.some((s) => s.title.length > 80)).toBe(true)
		expect(countStressSeedsByStatus(seeds, 'READING')).toBeGreaterThan(0)
		expect(countStressSeedsByStatus(seeds, 'ALL')).toBe(1000)
		expect(
			countStressSeedsByStatus(seeds, 'READING') +
				countStressSeedsByStatus(seeds, 'WANT_TO_READ') +
				countStressSeedsByStatus(seeds, 'FINISHED') +
				countStressSeedsByStatus(seeds, 'PAUSED') +
				countStressSeedsByStatus(seeds, 'ABANDONED'),
		).toBe(1000)
	})
})
