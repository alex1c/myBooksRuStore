/**
 * Progress and duration display helpers for library cards.
 */

import type { LibraryEntry } from '@/db/types'
import { bookDetailsCopy } from '@/constants/copy'

/** Convert hours + minutes into total seconds (non-negative). */
export function hoursMinutesToSeconds (hours: number, minutes: number): number {
	const h = Number.isFinite(hours) ? Math.max(0, Math.floor(hours)) : 0
	const m = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0
	return h * 3600 + m * 60
}

/** Split seconds into hours and minutes for form fields. */
export function secondsToHoursMinutes (totalSeconds: number | null | undefined): {
	hours: number
	minutes: number
} {
	const safe = Math.max(0, Math.floor(totalSeconds ?? 0))
	return {
		hours: Math.floor(safe / 3600),
		minutes: Math.floor((safe % 3600) / 60),
	}
}

/** Human-readable duration like `1 ч 24 мин`. */
export function formatDuration (totalSeconds: number): string {
	const { hours, minutes } = secondsToHoursMinutes(totalSeconds)
	if (hours <= 0) {
		return `${minutes} мин`
	}
	if (minutes <= 0) {
		return `${hours} ч`
	}
	return `${hours} ч ${minutes} мин`
}

/**
 * Compact progress line for cards. Returns null when there is nothing useful
 * to show (avoids `0 / 0` noise).
 */
export function formatProgressLabel (entry: LibraryEntry): string | null {
	if (entry.status === 'FINISHED') {
		return bookDetailsCopy.finished
	}

	if (entry.progressMode === 'PAGES') {
		const current = entry.currentPage
		const total = entry.totalPages
		if (current == null && total == null) {
			return null
		}
		if (current != null && total != null && total > 0) {
			const percent = Math.round((current / total) * 100)
			return `${current} / ${total} стр. · ${percent}%`
		}
		if (current != null) {
			return `${current} стр.`
		}
		if (total != null) {
			return `из ${total} стр.`
		}
		return null
	}

	if (entry.progressMode === 'PERCENT') {
		if (entry.currentPercent == null) {
			return null
		}
		return `${Math.round(entry.currentPercent)}%`
	}

	if (entry.progressMode === 'TIME') {
		const position = entry.audioPositionSeconds
		const duration = entry.audioDurationSeconds
		if (position == null && duration == null) {
			return null
		}
		if (position != null && duration != null && duration > 0) {
			return `${formatDuration(position)} / ${formatDuration(duration)}`
		}
		if (position != null) {
			return formatDuration(position)
		}
		if (duration != null) {
			return `из ${formatDuration(duration)}`
		}
	}

	return null
}

/** Cover monogram letter from title (deterministic placeholder). */
export function coverMonogram (title: string): string {
	const trimmed = title.trim()
	if (!trimmed) {
		return '?'
	}
	return trimmed.charAt(0).toLocaleUpperCase('ru-RU')
}

/** Stable soft background hue from title hash (no network images). */
export function coverPlaceholderColor (title: string): string {
	const palette = [
		'#2F6F5E',
		'#4F6B8A',
		'#6B5B7A',
		'#8A6B4F',
		'#5A7A5A',
		'#3D6B8A',
	]
	let hash = 0
	for (let i = 0; i < title.length; i += 1) {
		hash = (hash * 31 + title.charCodeAt(i)) >>> 0
	}
	return palette[hash % palette.length] ?? palette[0]
}
