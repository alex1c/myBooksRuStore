import { router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
	Pressable,
	SectionList,
	StyleSheet,
	Text,
	View,
} from 'react-native'

import { NoteCard } from '@/components/notes/NoteCard'
import {
	EmptyState,
	LoadingState,
	Screen,
	SearchField,
	SectionHeader,
} from '@/components/ui'
import { diaryCopy } from '@/constants/copy'
import { colors, radii, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import { listLibraryBooks } from '@/domain/libraryService'
import {
	getDiaryTimeline,
	type DiaryDaySection,
	type DiaryFilter,
	type DiaryItem,
} from '@/domain/diaryService'
import type { LibraryBookItem } from '@/db/types'

const FILTERS: { key: DiaryFilter; label: string }[] = [
	{ key: 'ALL', label: diaryCopy.filterAll },
	{ key: 'SESSIONS', label: diaryCopy.filterSessions },
	{ key: 'QUOTES', label: diaryCopy.filterQuotes },
	{ key: 'THOUGHTS', label: diaryCopy.filterThoughts },
	{ key: 'NOTES', label: diaryCopy.filterNotes },
]

/**
 * Diary tab — timeline of completed sessions + notes, grouped by local day.
 */
export default function DiaryScreen () {
	const { executor } = useDatabase()
	const [sections, setSections] = useState<DiaryDaySection[]>([])
	const [books, setBooks] = useState<LibraryBookItem[]>([])
	const [filter, setFilter] = useState<DiaryFilter>('ALL')
	const [bookId, setBookId] = useState<string | null>(null)
	const [searchInput, setSearchInput] = useState('')
	const [search, setSearch] = useState('')
	const [loading, setLoading] = useState(true)
	const [hasMore, setHasMore] = useState(false)
	const [offset, setOffset] = useState(0)

	// Debounce diary search like the library (250ms).
	useEffect(() => {
		const timer = setTimeout(() => setSearch(searchInput), 250)
		return () => clearTimeout(timer)
	}, [searchInput])

	const load = useCallback(
		async (nextOffset = 0, append = false) => {
			setLoading(true)
			try {
				const [timeline, library] = await Promise.all([
					getDiaryTimeline(executor, {
						filter,
						libraryEntryId: bookId,
						search,
						limit: 80,
						offset: nextOffset,
					}),
					listLibraryBooks(executor, { archived: false, sort: 'TITLE' }),
				])
				setBooks(library)
				setHasMore(timeline.hasMore)
				setOffset(nextOffset)
				if (append) {
					setSections((prev) => mergeSections(prev, timeline.sections))
				} else {
					setSections(timeline.sections)
				}
			} finally {
				setLoading(false)
			}
		},
		[executor, filter, bookId, search],
	)

	useFocusEffect(
		useCallback(() => {
			void load(0, false)
		}, [load]),
	)

	const listSections = useMemo(
		() =>
			sections.map((section) => ({
				title: section.title,
				dayKey: section.dayKey,
				data: section.items,
			})),
		[sections],
	)

	const renderItem = ({ item }: { item: DiaryItem }) => {
		if (item.kind === 'note') {
			return (
				<NoteCard
					note={item.note}
					bookTitle={item.bookTitle}
					progressMode={item.progressMode}
					onPress={() => router.push(`/notes/${item.note.id}`)}
				/>
			)
		}
		return (
			<Pressable
				accessibilityRole="button"
				onPress={() => router.push(`/books/${item.libraryEntryId}`)}
				style={styles.sessionCard}
			>
				<Text style={styles.sessionBook} numberOfLines={1}>
					{item.bookTitle}
				</Text>
				<Text style={styles.sessionSummary}>{item.summary}</Text>
			</Pressable>
		)
	}

	const isEmpty = !loading && sections.every((s) => s.items.length === 0)
	const hasFilters =
		filter !== 'ALL' || bookId != null || searchInput.trim().length > 0

	return (
		<Screen contentStyle={styles.content}>
			<SectionHeader title={diaryCopy.title} />

			<SearchField
				accessibilityLabel={diaryCopy.searchPlaceholder}
				placeholder={diaryCopy.searchPlaceholder}
				value={searchInput}
				onChangeText={setSearchInput}
			/>

			<View style={styles.filters}>
				{FILTERS.map((chip) => (
					<Pressable
						key={chip.key}
						accessibilityRole="button"
						accessibilityState={{ selected: filter === chip.key }}
						accessibilityLabel={chip.label}
						onPress={() => setFilter(chip.key)}
						style={[
							styles.chip,
							filter === chip.key ? styles.chipActive : null,
						]}
					>
						<Text
							style={[
								styles.chipLabel,
								filter === chip.key ? styles.chipLabelActive : null,
							]}
						>
							{chip.label}
						</Text>
					</Pressable>
				))}
			</View>

			<View style={styles.bookFilterRow}>
				<Pressable
					accessibilityRole="button"
					accessibilityState={{ selected: bookId == null }}
					onPress={() => setBookId(null)}
					style={[styles.chip, bookId == null ? styles.chipActive : null]}
				>
					<Text
						style={[
							styles.chipLabel,
							bookId == null ? styles.chipLabelActive : null,
						]}
					>
						{diaryCopy.allBooks}
					</Text>
				</Pressable>
				{books.slice(0, 8).map((book) => (
					<Pressable
						key={book.entry.id}
						accessibilityRole="button"
						accessibilityState={{ selected: bookId === book.entry.id }}
						onPress={() => setBookId(book.entry.id)}
						style={[
							styles.chip,
							bookId === book.entry.id ? styles.chipActive : null,
						]}
					>
						<Text
							style={[
								styles.chipLabel,
								bookId === book.entry.id ? styles.chipLabelActive : null,
							]}
							numberOfLines={1}
						>
							{book.book.title}
						</Text>
					</Pressable>
				))}
			</View>

			{loading && sections.length === 0 ? <LoadingState /> : null}

			{isEmpty ? (
				<View style={styles.empty}>
					<EmptyState
						icon="journal-outline"
						title={
							hasFilters
								? 'По выбранным фильтрам записей нет'
								: diaryCopy.emptyTitle
						}
						description={
							hasFilters
								? 'Сбросьте фильтр или очистите поиск.'
								: diaryCopy.emptyDescription
						}
						actionLabel={
							hasFilters ? 'Сбросить фильтры' : diaryCopy.goToBooks
						}
						onAction={() => {
							if (hasFilters) {
								setFilter('ALL')
								setBookId(null)
								setSearchInput('')
								return
							}
							router.push('/(tabs)/library')
						}}
					/>
				</View>
			) : (
				<SectionList
					sections={listSections}
					keyExtractor={(item) => `${item.kind}-${item.id}`}
					renderItem={renderItem}
					renderSectionHeader={({ section }) => (
						<Text style={styles.dayTitle}>{section.title}</Text>
					)}
					stickySectionHeadersEnabled={false}
					contentContainerStyle={styles.list}
					keyboardShouldPersistTaps="handled"
					onEndReached={() => {
						if (hasMore && !loading) {
							void load(offset + 80, true)
						}
					}}
					onEndReachedThreshold={0.4}
				/>
			)}
		</Screen>
	)
}

function mergeSections (
	prev: DiaryDaySection[],
	next: DiaryDaySection[],
): DiaryDaySection[] {
	const map = new Map<string, DiaryDaySection>()
	for (const section of prev) {
		map.set(section.dayKey, {
			...section,
			items: [...section.items],
		})
	}
	for (const section of next) {
		const existing = map.get(section.dayKey)
		if (!existing) {
			map.set(section.dayKey, { ...section, items: [...section.items] })
			continue
		}
		const seen = new Set(existing.items.map((i) => `${i.kind}-${i.id}`))
		for (const item of section.items) {
			const key = `${item.kind}-${item.id}`
			if (!seen.has(key)) {
				existing.items.push(item)
			}
		}
	}
	return [...map.values()]
}

const styles = StyleSheet.create({
	content: {
		flex: 1,
		paddingBottom: 0,
		gap: spacing.xs,
	},
	filters: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.xs,
		marginBottom: spacing.xs,
	},
	bookFilterRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.xs,
		marginBottom: spacing.sm,
	},
	chip: {
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
		borderRadius: radii.sm,
		backgroundColor: colors.surfaceMuted,
		maxWidth: 140,
		minHeight: 40,
		justifyContent: 'center',
	},
	chipActive: {
		backgroundColor: colors.primarySoft,
		borderWidth: 1,
		borderColor: colors.primary,
	},
	chipLabel: {
		...typography.caption,
		color: colors.textSecondary,
	},
	chipLabelActive: {
		color: colors.primaryDark,
		fontWeight: '700',
	},
	dayTitle: {
		...typography.section,
		color: colors.text,
		marginTop: spacing.sm,
		marginBottom: spacing.xs,
	},
	sessionCard: {
		backgroundColor: colors.surface,
		borderRadius: radii.md,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
		padding: spacing.sm,
		marginBottom: spacing.sm,
		gap: 2,
	},
	sessionBook: {
		...typography.bodySmall,
		fontWeight: '700',
		color: colors.text,
	},
	sessionSummary: {
		...typography.bodySmall,
		color: colors.primaryDark,
	},
	list: {
		paddingBottom: spacing.xxl,
	},
	empty: {
		flex: 1,
		justifyContent: 'center',
		paddingVertical: spacing.xl,
	},
})
