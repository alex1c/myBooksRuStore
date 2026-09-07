import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'

import { ChoiceGroup } from '@/components/library/ChipScroller'
import { CoverThumbnail } from '@/components/library/CoverThumbnail'
import {
	PrimaryButton,
	Screen,
	SecondaryButton,
	SectionHeader,
	TextField,
} from '@/components/ui'
import { appCopy, searchCopy } from '@/constants/copy'
import {
	BOOK_FORMATS,
	LIBRARY_STATUSES,
	defaultProgressModeForFormat,
	type BookFormat,
	type LibraryStatus,
} from '@/constants/domain'
import { formatLabels, statusLabels } from '@/constants/labels'
import { colors, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import {
	addExternalBookToLibrary,
	findLibraryDuplicates,
} from '@/domain/libraryService'
import { getPendingSearchCandidate } from '@/services/bookSearch/pendingCandidate'

/**
 * Compact preview/add for a catalogue candidate — edit metadata before save.
 */
export default function SearchPreviewScreen () {
	const { executor } = useDatabase()
	const candidate = useMemo(() => getPendingSearchCandidate(), [])
	const [title, setTitle] = useState(candidate?.title ?? '')
	const [authorText, setAuthorText] = useState(candidate?.authorText ?? '')
	const [subtitle, setSubtitle] = useState(candidate?.subtitle ?? '')
	const [publisher, setPublisher] = useState(candidate?.publisher ?? '')
	const [publishedYear, setPublishedYear] = useState(
		candidate?.publishedYear != null ? String(candidate.publishedYear) : '',
	)
	const [pageCount, setPageCount] = useState(
		candidate?.pageCount != null ? String(candidate.pageCount) : '',
	)
	const [status, setStatus] = useState<LibraryStatus>('WANT_TO_READ')
	const [format, setFormat] = useState<BookFormat>('PAPER')
	const [editing, setEditing] = useState(false)
	const [saving, setSaving] = useState(false)

	if (!candidate) {
		return (
			<Screen>
				<Text style={styles.missing}>Результат поиска не найден</Text>
				<SecondaryButton label="Назад" onPress={() => router.back()} />
			</Screen>
		)
	}

	const persist = async (forceAdd = false) => {
		const year = publishedYear.trim() ? Number(publishedYear) : null
		const pages = pageCount.trim() ? Number(pageCount) : null
		const draft = {
			title: title.trim(),
			authorText: authorText.trim(),
			subtitle: subtitle.trim() || null,
			publisher: publisher.trim() || null,
			publishedYear: year != null && Number.isFinite(year) ? year : null,
			pageCount: pages != null && Number.isFinite(pages) ? pages : null,
			isbn10: candidate.isbn10,
			isbn13: candidate.isbn13,
			language: candidate.language,
			coverUrl: candidate.coverUrl,
			source: candidate.source,
			sourceExternalId: candidate.sourceExternalId,
			status,
			format,
			progressMode: defaultProgressModeForFormat(format),
		}

		if (!draft.title) {
			Alert.alert(appCopy.name, 'Укажите название книги')
			return
		}

		if (!forceAdd) {
			const duplicates = await findLibraryDuplicates(executor, {
				title: draft.title,
				authorText: draft.authorText,
				isbn10: draft.isbn10,
				isbn13: draft.isbn13,
			})
			if (duplicates.hasDuplicates) {
				const first = duplicates.matches[0]
				Alert.alert(
					searchCopy.duplicateTitle,
					first
						? `${first.book.title}${first.book.authorText ? ` — ${first.book.authorText}` : ''}`
						: undefined,
					[
						{
							text: searchCopy.duplicateAddEdition,
							onPress: () => {
								void persist(true)
							},
						},
						...(first
							? [
								{
									text: searchCopy.duplicateOpen,
									onPress: () =>
										router.replace(`/books/${first.entry.id}`),
								},
							]
							: []),
						{ text: appCopy.cancel, style: 'cancel' as const },
					],
				)
				return
			}
		}

		try {
			setSaving(true)
			const created = await addExternalBookToLibrary(executor, draft)
			router.replace(`/books/${created.entry.id}`)
		} catch (error) {
			Alert.alert(
				appCopy.errorTitle,
				error instanceof Error ? error.message : 'Не удалось сохранить книгу',
			)
		} finally {
			setSaving(false)
		}
	}

	return (
		<Screen scroll keyboardAvoiding contentStyle={styles.content}>
			<SectionHeader title={searchCopy.previewTitle} />
			<View style={styles.hero}>
				<CoverThumbnail
					title={title || candidate.title}
					coverUri={candidate.coverUrl}
					size={88}
				/>
				<View style={styles.heroText}>
					<Text style={styles.title}>{title || candidate.title}</Text>
					<Text style={styles.author}>
						{authorText.trim() || appCopy.authorUnknown}
					</Text>
					<Text style={styles.meta}>
						{[
							pageCount ? `${pageCount} стр.` : null,
							publishedYear || null,
						]
							.filter(Boolean)
							.join(' · ')}
					</Text>
				</View>
			</View>

			<ChoiceGroup
				label="Статус"
				options={LIBRARY_STATUSES.map((value) => ({
					value,
					label: statusLabels[value],
				}))}
				value={status}
				onChange={setStatus}
			/>
			<ChoiceGroup
				label="Формат"
				options={BOOK_FORMATS.map((value) => ({
					value,
					label: formatLabels[value],
				}))}
				value={format}
				onChange={setFormat}
			/>

			{editing ? (
				<View style={styles.editBlock}>
					<TextField label="Название" value={title} onChangeText={setTitle} />
					<TextField
						label="Автор"
						value={authorText}
						onChangeText={setAuthorText}
					/>
					<TextField
						label="Подзаголовок"
						value={subtitle}
						onChangeText={setSubtitle}
					/>
					<TextField
						label="Издательство"
						value={publisher}
						onChangeText={setPublisher}
					/>
					<TextField
						label="Год"
						value={publishedYear}
						onChangeText={setPublishedYear}
						keyboardType="number-pad"
					/>
					<TextField
						label="Страниц"
						value={pageCount}
						onChangeText={setPageCount}
						keyboardType="number-pad"
					/>
				</View>
			) : (
				<SecondaryButton
					label={searchCopy.previewEdit}
					onPress={() => setEditing(true)}
				/>
			)}

			<PrimaryButton
				label={searchCopy.previewSubmit}
				loading={saving}
				onPress={() => {
					void persist(false)
				}}
			/>
			<Text style={styles.attribution}>{searchCopy.attribution}</Text>
		</Screen>
	)
}

const styles = StyleSheet.create({
	content: {
		gap: spacing.md,
		paddingBottom: spacing.xxl,
	},
	hero: {
		flexDirection: 'row',
		gap: spacing.md,
	},
	heroText: {
		flex: 1,
		minWidth: 0,
		gap: spacing.xxs,
		justifyContent: 'center',
	},
	title: {
		...typography.title,
		fontSize: 22,
		lineHeight: 28,
	},
	author: {
		...typography.body,
		color: colors.textSecondary,
	},
	meta: {
		...typography.bodySmall,
		color: colors.muted,
	},
	editBlock: {
		gap: spacing.sm,
	},
	attribution: {
		...typography.caption,
		color: colors.muted,
		textAlign: 'center',
	},
	missing: {
		...typography.body,
		color: colors.textSecondary,
		textAlign: 'center',
		marginVertical: spacing.xl,
	},
})
