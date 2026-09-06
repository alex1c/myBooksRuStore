import { useMemo, useState } from 'react'
import {
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native'

import { ChoiceGroup } from '@/components/library/ChipScroller'
import { PrimaryButton, SecondaryButton, TextField } from '@/components/ui'
import { addBookCopy, appCopy, validationCopy } from '@/constants/copy'
import {
	BOOK_FORMATS,
	LIBRARY_STATUSES,
	PROGRESS_MODES,
	defaultProgressModeForFormat,
	type BookFormat,
	type FinishedDatePrecision,
	type LibraryStatus,
	type ProgressMode,
} from '@/constants/domain'
import {
	formatLabels,
	progressModeLabels,
	statusLabels,
} from '@/constants/labels'
import { colors, radii, spacing, typography } from '@/constants/theme'
import type { LibraryBookItem, Shelf } from '@/db/types'
import {
	finishedExactPayload,
	finishedTodayPayload,
	finishedUnknownPayload,
	finishedYearPayload,
	suggestFinishedProgress,
} from '@/domain/libraryService'
import {
	validateFinishedDate,
	validateIsbn10,
	validateIsbn13,
	validateProgress,
	validatePublishedYear,
	validateRating,
	validateTitle,
} from '@/domain/libraryValidation'
import { toDateOnlyLocal } from '@/utils/dates'
import {
	hoursMinutesToSeconds,
	secondsToHoursMinutes,
} from '@/utils/progress'

export interface BookFormValues {
	title: string
	authorText: string
	subtitle: string
	isbn10: string
	isbn13: string
	publisher: string
	publishedYear: string
	pageCount: string
	description: string
	format: BookFormat
	status: LibraryStatus
	progressMode: ProgressMode
	currentPage: string
	totalPages: string
	currentPercent: string
	positionHours: string
	positionMinutes: string
	durationHours: string
	durationMinutes: string
	rating: string
	reviewText: string
	finishedChoice: 'today' | 'year' | 'earlier' | 'date' | 'none'
	finishedOn: string
	finishedYear: string
	shelfIds: string[]
}

export function emptyBookFormValues (): BookFormValues {
	return {
		title: '',
		authorText: '',
		subtitle: '',
		isbn10: '',
		isbn13: '',
		publisher: '',
		publishedYear: '',
		pageCount: '',
		description: '',
		format: 'PAPER',
		status: 'WANT_TO_READ',
		progressMode: 'PAGES',
		currentPage: '',
		totalPages: '',
		currentPercent: '',
		positionHours: '',
		positionMinutes: '',
		durationHours: '',
		durationMinutes: '',
		rating: '',
		reviewText: '',
		finishedChoice: 'none',
		finishedOn: toDateOnlyLocal(),
		finishedYear: String(new Date().getFullYear()),
		shelfIds: [],
	}
}

export function valuesFromLibraryItem (item: LibraryBookItem): BookFormValues {
	const pos = secondsToHoursMinutes(item.entry.audioPositionSeconds)
	const dur = secondsToHoursMinutes(item.entry.audioDurationSeconds)
	let finishedChoice: BookFormValues['finishedChoice'] = 'none'
	if (item.entry.status === 'FINISHED') {
		if (item.entry.finishedDatePrecision === 'EXACT') {
			finishedChoice =
				item.entry.finishedOn === toDateOnlyLocal() ? 'today' : 'date'
		} else if (item.entry.finishedDatePrecision === 'YEAR') {
			finishedChoice = 'year'
		} else {
			finishedChoice = 'earlier'
		}
	}

	return {
		title: item.book.title,
		authorText: item.book.authorText,
		subtitle: item.book.subtitle ?? '',
		isbn10: item.book.isbn10 ?? '',
		isbn13: item.book.isbn13 ?? '',
		publisher: item.book.publisher ?? '',
		publishedYear:
			item.book.publishedYear != null ? String(item.book.publishedYear) : '',
		pageCount: item.book.pageCount != null ? String(item.book.pageCount) : '',
		description: item.book.description ?? '',
		format: item.entry.format,
		status: item.entry.status,
		progressMode: item.entry.progressMode,
		currentPage:
			item.entry.currentPage != null ? String(item.entry.currentPage) : '',
		totalPages:
			item.entry.totalPages != null ? String(item.entry.totalPages) : '',
		currentPercent:
			item.entry.currentPercent != null
				? String(item.entry.currentPercent)
				: '',
		positionHours: item.entry.audioPositionSeconds != null ? String(pos.hours) : '',
		positionMinutes:
			item.entry.audioPositionSeconds != null ? String(pos.minutes) : '',
		durationHours:
			item.entry.audioDurationSeconds != null ? String(dur.hours) : '',
		durationMinutes:
			item.entry.audioDurationSeconds != null ? String(dur.minutes) : '',
		rating: item.entry.rating != null ? String(item.entry.rating) : '',
		reviewText: item.entry.reviewText ?? '',
		finishedChoice,
		finishedOn: item.entry.finishedOn ?? toDateOnlyLocal(),
		finishedYear:
			item.entry.finishedYear != null
				? String(item.entry.finishedYear)
				: String(new Date().getFullYear()),
		shelfIds: [...item.shelfIds],
	}
}

function parseOptionalInt (raw: string): number | null {
	const trimmed = raw.trim()
	if (!trimmed) {
		return null
	}
	const value = Number(trimmed)
	return Number.isFinite(value) ? Math.trunc(value) : Number.NaN
}

function parseOptionalFloat (raw: string): number | null {
	const trimmed = raw.trim().replace(',', '.')
	if (!trimmed) {
		return null
	}
	const value = Number(trimmed)
	return Number.isFinite(value) ? value : Number.NaN
}

export interface ParsedBookForm {
	book: {
		title: string
		authorText: string
		subtitle: string | null
		isbn10: string | null
		isbn13: string | null
		publisher: string | null
		publishedYear: number | null
		pageCount: number | null
		description: string | null
	}
	entry: {
		status: LibraryStatus
		format: BookFormat
		progressMode: ProgressMode
		currentPage: number | null
		totalPages: number | null
		currentPercent: number | null
		audioPositionSeconds: number | null
		audioDurationSeconds: number | null
		rating: number | null
		reviewText: string | null
		finishedDatePrecision: FinishedDatePrecision | null
		finishedOn: string | null
		finishedYear: number | null
	}
	shelfIds: string[]
}

export function parseBookForm (
	values: BookFormValues,
): { ok: true; data: ParsedBookForm } | { ok: false; error: string } {
	const titleError = validateTitle(values.title)
	if (titleError) {
		return { ok: false, error: titleError }
	}

	const publishedYear = parseOptionalInt(values.publishedYear)
	if (publishedYear != null && Number.isNaN(publishedYear)) {
		return { ok: false, error: validationCopy.invalidYear }
	}
	const yearError = validatePublishedYear(publishedYear)
	if (yearError) {
		return { ok: false, error: yearError }
	}

	const isbn10Error = validateIsbn10(values.isbn10)
	if (isbn10Error) {
		return { ok: false, error: isbn10Error }
	}
	const isbn13Error = validateIsbn13(values.isbn13)
	if (isbn13Error) {
		return { ok: false, error: isbn13Error }
	}

	const pageCount = parseOptionalInt(values.pageCount)
	if (pageCount != null && (Number.isNaN(pageCount) || pageCount <= 0)) {
		return { ok: false, error: validationCopy.invalidTotalPages }
	}

	const currentPage = parseOptionalInt(values.currentPage)
	const totalPages = parseOptionalInt(values.totalPages)
	const currentPercent = parseOptionalFloat(values.currentPercent)
	if (currentPage != null && Number.isNaN(currentPage)) {
		return { ok: false, error: validationCopy.invalidPage }
	}
	if (totalPages != null && Number.isNaN(totalPages)) {
		return { ok: false, error: validationCopy.invalidTotalPages }
	}
	if (currentPercent != null && Number.isNaN(currentPercent)) {
		return { ok: false, error: validationCopy.invalidPercent }
	}

	const posH = parseOptionalInt(values.positionHours) ?? 0
	const posM = parseOptionalInt(values.positionMinutes) ?? 0
	const durH = parseOptionalInt(values.durationHours) ?? 0
	const durM = parseOptionalInt(values.durationMinutes) ?? 0
	const hasPosition =
		values.positionHours.trim() !== '' || values.positionMinutes.trim() !== ''
	const hasDuration =
		values.durationHours.trim() !== '' || values.durationMinutes.trim() !== ''

	const audioPositionSeconds = hasPosition
		? hoursMinutesToSeconds(
			Number.isNaN(posH) ? 0 : posH,
			Number.isNaN(posM) ? 0 : posM,
		)
		: null
	const audioDurationSeconds = hasDuration
		? hoursMinutesToSeconds(
			Number.isNaN(durH) ? 0 : durH,
			Number.isNaN(durM) ? 0 : durM,
		)
		: null

	const progressError = validateProgress({
		progressMode: values.progressMode,
		currentPage,
		totalPages,
		currentPercent,
		audioPositionSeconds,
		audioDurationSeconds,
	})
	if (progressError) {
		return { ok: false, error: progressError }
	}

	const rating = parseOptionalFloat(values.rating)
	if (rating != null && Number.isNaN(rating)) {
		return { ok: false, error: validationCopy.invalidRating }
	}
	const ratingError = validateRating(rating)
	if (ratingError) {
		return { ok: false, error: ratingError }
	}

	let finishedDatePrecision: FinishedDatePrecision | null = null
	let finishedOn: string | null = null
	let finishedYear: number | null = null

	if (values.status === 'FINISHED') {
		if (values.finishedChoice === 'today') {
			const payload = finishedTodayPayload()
			finishedDatePrecision = payload.finishedDatePrecision
			finishedOn = payload.finishedOn
		} else if (values.finishedChoice === 'date') {
			const payload = finishedExactPayload(values.finishedOn.trim())
			finishedDatePrecision = payload.finishedDatePrecision
			finishedOn = payload.finishedOn
		} else if (values.finishedChoice === 'year') {
			const year = parseOptionalInt(values.finishedYear)
			if (year == null || Number.isNaN(year)) {
				return { ok: false, error: validationCopy.invalidFinishedYear }
			}
			const payload = finishedYearPayload(year)
			finishedDatePrecision = payload.finishedDatePrecision
			finishedYear = payload.finishedYear
		} else {
			const payload = finishedUnknownPayload()
			finishedDatePrecision = payload.finishedDatePrecision
		}
	}

	const finishedError = validateFinishedDate(values.status, {
		precision: finishedDatePrecision,
		finishedOn,
		finishedYear,
	})
	if (finishedError) {
		return { ok: false, error: finishedError }
	}

	return {
		ok: true,
		data: {
			book: {
				title: values.title.trim(),
				authorText: values.authorText.trim(),
				subtitle: values.subtitle.trim() || null,
				isbn10: values.isbn10.trim() || null,
				isbn13: values.isbn13.trim() || null,
				publisher: values.publisher.trim() || null,
				publishedYear,
				pageCount,
				description: values.description.trim() || null,
			},
			entry: {
				status: values.status,
				format: values.format,
				progressMode: values.progressMode,
				currentPage,
				totalPages,
				currentPercent,
				audioPositionSeconds,
				audioDurationSeconds,
				rating,
				reviewText: values.reviewText.trim() || null,
				finishedDatePrecision,
				finishedOn,
				finishedYear,
			},
			shelfIds: values.shelfIds,
		},
	}
}

interface BookFormProps {
	initial: BookFormValues
	shelves: Shelf[]
	submitLabel: string
	onSubmit: (data: ParsedBookForm) => Promise<void> | void
	onCancel?: () => void
}

/**
 * Shared add/edit form: short primary fields + expandable details.
 */
export function BookForm ({
	initial,
	shelves,
	submitLabel,
	onSubmit,
	onCancel,
}: BookFormProps) {
	const [values, setValues] = useState<BookFormValues>(initial)
	const [showMore, setShowMore] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)

	const formatOptions = useMemo(
		() => BOOK_FORMATS.map((value) => ({ value, label: formatLabels[value] })),
		[],
	)
	const statusOptions = useMemo(
		() =>
			LIBRARY_STATUSES.map((value) => ({
				value,
				label: statusLabels[value],
			})),
		[],
	)
	const progressOptions = useMemo(
		() =>
			PROGRESS_MODES.map((value) => ({
				value,
				label: progressModeLabels[value],
			})),
		[],
	)

	const patch = (partial: Partial<BookFormValues>) => {
		setValues((prev) => ({ ...prev, ...partial }))
	}

	const handleFormatChange = (format: BookFormat) => {
		setValues((prev) => ({
			...prev,
			format,
			// Suggest progress mode when format changes, but keep user override possible later.
			progressMode: defaultProgressModeForFormat(format),
		}))
	}

	const handleStatusChange = (status: LibraryStatus) => {
		setValues((prev) => {
			const next: BookFormValues = { ...prev, status }
			if (status === 'FINISHED') {
				if (prev.finishedChoice === 'none') {
					next.finishedChoice = 'today'
				}
				const pageCount = parseOptionalInt(prev.pageCount)
				const suggested = suggestFinishedProgress({
					progressMode: prev.progressMode,
					currentPage: parseOptionalInt(prev.currentPage),
					totalPages: parseOptionalInt(prev.totalPages),
					currentPercent: parseOptionalFloat(prev.currentPercent),
					audioPositionSeconds: null,
					audioDurationSeconds: hoursMinutesToSeconds(
						parseOptionalInt(prev.durationHours) ?? 0,
						parseOptionalInt(prev.durationMinutes) ?? 0,
					),
					bookPageCount: pageCount,
				})
				if (suggested.currentPage != null) {
					next.currentPage = String(suggested.currentPage)
				}
				if (suggested.totalPages != null) {
					next.totalPages = String(suggested.totalPages)
				}
				if (suggested.currentPercent != null) {
					next.currentPercent = String(suggested.currentPercent)
				}
				if (suggested.audioPositionSeconds != null) {
					const parts = secondsToHoursMinutes(suggested.audioPositionSeconds)
					next.positionHours = String(parts.hours)
					next.positionMinutes = String(parts.minutes)
				}
			} else {
				next.finishedChoice = 'none'
			}
			return next
		})
	}

	const toggleShelf = (shelfId: string) => {
		setValues((prev) => {
			const exists = prev.shelfIds.includes(shelfId)
			return {
				...prev,
				shelfIds: exists
					? prev.shelfIds.filter((id) => id !== shelfId)
					: [...prev.shelfIds, shelfId],
			}
		})
	}

	const handleSubmit = async () => {
		const parsed = parseBookForm(values)
		if (!parsed.ok) {
			setError(parsed.error)
			return
		}
		try {
			setSaving(true)
			setError(null)
			await onSubmit(parsed.data)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'save_failed')
		} finally {
			setSaving(false)
		}
	}

	return (
		<View style={styles.form}>
			<TextField
				label={addBookCopy.titleLabel}
				placeholder={addBookCopy.titlePlaceholder}
				value={values.title}
				onChangeText={(title) => patch({ title })}
				autoCapitalize="sentences"
			/>
			<TextField
				label={addBookCopy.authorLabel}
				placeholder={addBookCopy.authorPlaceholder}
				value={values.authorText}
				onChangeText={(authorText) => patch({ authorText })}
			/>

			<ChoiceGroup
				label={addBookCopy.formatLabel}
				options={formatOptions}
				value={values.format}
				onChange={handleFormatChange}
			/>
			<ChoiceGroup
				label={addBookCopy.statusLabel}
				options={statusOptions}
				value={values.status}
				onChange={handleStatusChange}
			/>
			<ChoiceGroup
				label={addBookCopy.progressModeLabel}
				options={progressOptions}
				value={values.progressMode}
				onChange={(progressMode) => patch({ progressMode })}
			/>

			{values.progressMode === 'PAGES' ? (
				<View style={styles.row}>
					<View style={styles.half}>
						<TextField
							label={addBookCopy.currentPageLabel}
							value={values.currentPage}
							onChangeText={(currentPage) => patch({ currentPage })}
							keyboardType="number-pad"
						/>
					</View>
					<View style={styles.half}>
						<TextField
							label={addBookCopy.totalPagesLabel}
							value={values.totalPages}
							onChangeText={(totalPages) => patch({ totalPages })}
							keyboardType="number-pad"
						/>
					</View>
				</View>
			) : null}

			{values.progressMode === 'PERCENT' ? (
				<TextField
					label={addBookCopy.percentLabel}
					value={values.currentPercent}
					onChangeText={(currentPercent) => patch({ currentPercent })}
					keyboardType="decimal-pad"
				/>
			) : null}

			{values.progressMode === 'TIME' ? (
				<>
					<Text style={styles.inlineLabel}>{addBookCopy.audioPositionLabel}</Text>
					<View style={styles.row}>
						<View style={styles.half}>
							<TextField
								label={addBookCopy.hoursLabel}
								value={values.positionHours}
								onChangeText={(positionHours) => patch({ positionHours })}
								keyboardType="number-pad"
							/>
						</View>
						<View style={styles.half}>
							<TextField
								label={addBookCopy.minutesLabel}
								value={values.positionMinutes}
								onChangeText={(positionMinutes) => patch({ positionMinutes })}
								keyboardType="number-pad"
							/>
						</View>
					</View>
					<Text style={styles.inlineLabel}>{addBookCopy.audioDurationLabel}</Text>
					<View style={styles.row}>
						<View style={styles.half}>
							<TextField
								label={addBookCopy.hoursLabel}
								value={values.durationHours}
								onChangeText={(durationHours) => patch({ durationHours })}
								keyboardType="number-pad"
							/>
						</View>
						<View style={styles.half}>
							<TextField
								label={addBookCopy.minutesLabel}
								value={values.durationMinutes}
								onChangeText={(durationMinutes) => patch({ durationMinutes })}
								keyboardType="number-pad"
							/>
						</View>
					</View>
				</>
			) : null}

			{values.status === 'FINISHED' ? (
				<View style={styles.block}>
					<Text style={styles.inlineLabel}>{addBookCopy.finishedWhenLabel}</Text>
					<ChoiceGroup
						label=""
						options={[
							{ value: 'today', label: addBookCopy.finishedToday },
							{ value: 'year', label: addBookCopy.finishedThisYear },
							{ value: 'earlier', label: addBookCopy.finishedEarlier },
							{ value: 'date', label: addBookCopy.finishedPickDate },
						]}
						value={values.finishedChoice === 'none' ? 'today' : values.finishedChoice}
						onChange={(finishedChoice) =>
							patch({
								finishedChoice: finishedChoice as BookFormValues['finishedChoice'],
							})
						}
					/>
					{values.finishedChoice === 'date' ? (
						<TextField
							label={addBookCopy.finishedDateLabel}
							value={values.finishedOn}
							onChangeText={(finishedOn) => patch({ finishedOn })}
							placeholder="YYYY-MM-DD"
							autoCapitalize="none"
						/>
					) : null}
					{values.finishedChoice === 'year' ? (
						<TextField
							label={addBookCopy.finishedYearLabel}
							value={values.finishedYear}
							onChangeText={(finishedYear) => patch({ finishedYear })}
							keyboardType="number-pad"
						/>
					) : null}
					<TextField
						label={addBookCopy.ratingLabel}
						value={values.rating}
						onChangeText={(rating) => patch({ rating })}
						keyboardType="decimal-pad"
						placeholder="0–5"
					/>
					<TextField
						label={addBookCopy.reviewLabel}
						value={values.reviewText}
						onChangeText={(reviewText) => patch({ reviewText })}
						placeholder={addBookCopy.reviewPlaceholder}
						multiline
						style={styles.multiline}
					/>
				</View>
			) : null}

			{shelves.length > 0 ? (
				<View style={styles.block}>
					<Text style={styles.inlineLabel}>{addBookCopy.shelvesLabel}</Text>
					<View style={styles.wrap}>
						{shelves.map((shelf) => {
							const selected = values.shelfIds.includes(shelf.id)
							return (
								<Pressable
									key={shelf.id}
									accessibilityRole="button"
									accessibilityState={{ selected }}
									onPress={() => toggleShelf(shelf.id)}
									style={[styles.shelfChip, selected && styles.shelfSelected]}
								>
									<Text
										style={[
											styles.shelfLabel,
											selected && styles.shelfLabelSelected,
										]}
									>
										{shelf.name}
									</Text>
								</Pressable>
							)
						})}
					</View>
				</View>
			) : null}

			<SecondaryButton
				label={addBookCopy.moreDetails}
				onPress={() => setShowMore((value) => !value)}
			/>

			{showMore ? (
				<View style={styles.block}>
					<TextField
						label={addBookCopy.subtitleLabel}
						value={values.subtitle}
						onChangeText={(subtitle) => patch({ subtitle })}
					/>
					<TextField
						label={addBookCopy.isbn13Label}
						value={values.isbn13}
						onChangeText={(isbn13) => patch({ isbn13 })}
						autoCapitalize="none"
					/>
					<TextField
						label={addBookCopy.isbn10Label}
						value={values.isbn10}
						onChangeText={(isbn10) => patch({ isbn10 })}
						autoCapitalize="none"
					/>
					<TextField
						label={addBookCopy.publisherLabel}
						value={values.publisher}
						onChangeText={(publisher) => patch({ publisher })}
					/>
					<TextField
						label={addBookCopy.yearLabel}
						value={values.publishedYear}
						onChangeText={(publishedYear) => patch({ publishedYear })}
						keyboardType="number-pad"
					/>
					<TextField
						label={addBookCopy.pageCountLabel}
						value={values.pageCount}
						onChangeText={(pageCount) => patch({ pageCount })}
						keyboardType="number-pad"
					/>
					{values.progressMode === 'PAGES' &&
					values.pageCount.trim() &&
					!values.totalPages.trim() ? (
						<SecondaryButton
							label={addBookCopy.useBookPageCount}
							onPress={() => patch({ totalPages: values.pageCount.trim() })}
						/>
					) : null}
					<TextField
						label={addBookCopy.descriptionLabel}
						value={values.description}
						onChangeText={(description) => patch({ description })}
						multiline
						style={styles.multiline}
					/>
					{values.status !== 'FINISHED' ? (
						<>
							<TextField
								label={addBookCopy.ratingLabel}
								value={values.rating}
								onChangeText={(rating) => patch({ rating })}
								keyboardType="decimal-pad"
								placeholder="0–5"
							/>
							<TextField
								label={addBookCopy.reviewLabel}
								value={values.reviewText}
								onChangeText={(reviewText) => patch({ reviewText })}
								placeholder={addBookCopy.reviewPlaceholder}
								multiline
								style={styles.multiline}
							/>
						</>
					) : null}
				</View>
			) : null}

			{error ? <Text style={styles.error}>{error}</Text> : null}

			<PrimaryButton
				label={submitLabel}
				onPress={() => {
					void handleSubmit()
				}}
				loading={saving}
			/>
			{onCancel ? (
				<SecondaryButton label={appCopy.cancel} onPress={onCancel} />
			) : null}
		</View>
	)
}

const styles = StyleSheet.create({
	form: {
		gap: spacing.md,
		paddingBottom: spacing.xxl,
	},
	row: {
		flexDirection: 'row',
		gap: spacing.sm,
	},
	half: {
		flex: 1,
	},
	block: {
		gap: spacing.sm,
	},
	inlineLabel: {
		...typography.bodySmall,
		color: colors.textSecondary,
		fontWeight: '600',
	},
	multiline: {
		minHeight: 96,
		textAlignVertical: 'top',
	},
	wrap: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.xs,
	},
	shelfChip: {
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
		borderRadius: radii.full,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.surface,
	},
	shelfSelected: {
		borderColor: colors.primary,
		backgroundColor: colors.primarySoft,
	},
	shelfLabel: {
		...typography.bodySmall,
		color: colors.textSecondary,
	},
	shelfLabelSelected: {
		color: colors.primaryDark,
		fontWeight: '600',
	},
	error: {
		...typography.bodySmall,
		color: colors.danger,
	},
})
