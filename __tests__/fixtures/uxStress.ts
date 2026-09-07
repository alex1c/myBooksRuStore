/**
 * Dev/test-only UX stress fixtures — NEVER seed production DB from these.
 */

export interface StressBookSeed {
	title: string
	authorText: string
	status: 'READING' | 'WANT_TO_READ' | 'FINISHED' | 'PAUSED' | 'ABANDONED'
	hasCover: boolean
	longNote?: string
}

const LONG_TITLE =
	'Очень длинное название книги, которое не должно вытеснять действия и ломать карточку в списке библиотеки'

const LONG_NOTE =
	'Длинная цитата для проверки многострочного текста.\nВторая строка.\nТретья строка с кириллицей: «Мастер и Маргарита».'

/**
 * Generate N library book seeds with mixed statuses, missing authors/covers,
 * and occasional long titles/notes for FlatList / empty-state stress tests.
 */
export function buildUxStressLibrarySeeds (count: number): StressBookSeed[] {
	const statuses: StressBookSeed['status'][] = [
		'READING',
		'WANT_TO_READ',
		'FINISHED',
		'PAUSED',
		'ABANDONED',
	]
	const seeds: StressBookSeed[] = []
	for (let i = 0; i < count; i += 1) {
		const status = statuses[i % statuses.length]!
		seeds.push({
			title: i % 17 === 0 ? `${LONG_TITLE} ${i + 1}` : `Книга ${i + 1}`,
			authorText: i % 11 === 0 ? '' : `Автор ${i + 1}`,
			status,
			hasCover: i % 5 !== 0,
			longNote: i % 23 === 0 ? LONG_NOTE : undefined,
		})
	}
	return seeds
}

/** Count how many seeds match a status filter (for empty/filter UX checks). */
export function countStressSeedsByStatus (
	seeds: StressBookSeed[],
	status: StressBookSeed['status'] | 'ALL',
): number {
	if (status === 'ALL') {
		return seeds.length
	}
	return seeds.filter((s) => s.status === status).length
}
