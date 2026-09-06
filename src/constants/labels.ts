/**
 * Russian labels for domain enums shown in UI.
 */

import type {
	BookFormat,
	FinishedDatePrecision,
	LibrarySort,
	LibraryStatus,
	NoteType,
	ProgressMode,
} from '@/constants/domain'

export const statusLabels: Record<LibraryStatus, string> = {
	WANT_TO_READ: 'Хочу прочитать',
	READING: 'Читаю',
	FINISHED: 'Прочитано',
	PAUSED: 'Отложено',
	ABANDONED: 'Брошено',
}

/** Short chip labels for the library filter bar. */
export const statusFilterLabels: Record<LibraryStatus | 'ALL', string> = {
	ALL: 'Все',
	READING: 'Читаю',
	WANT_TO_READ: 'Хочу',
	FINISHED: 'Прочитано',
	PAUSED: 'Отложено',
	ABANDONED: 'Брошено',
}

export const formatLabels: Record<BookFormat, string> = {
	PAPER: 'Бумажная',
	EBOOK: 'Электронная',
	AUDIOBOOK: 'Аудиокнига',
}

export const progressModeLabels: Record<ProgressMode, string> = {
	PAGES: 'Страницы',
	PERCENT: 'Проценты',
	TIME: 'Время',
}

export const noteTypeLabels: Record<NoteType, string> = {
	QUOTE: 'Цитата',
	THOUGHT: 'Мысль',
	NOTE: 'Заметка',
}

export const sortLabels: Record<LibrarySort, string> = {
	RECENTLY_ADDED: 'Недавно добавленные',
	TITLE: 'Название',
	AUTHOR: 'Автор',
	RECENTLY_UPDATED: 'Недавно обновлённые',
	FINISHED_DATE: 'Дата прочтения',
}

export const finishedPrecisionLabels: Record<FinishedDatePrecision, string> = {
	EXACT: 'Точная дата',
	YEAR: 'Только год',
	UNKNOWN: 'Дата неизвестна',
}

export const unknownAuthorLabel = 'Автор не указан'
