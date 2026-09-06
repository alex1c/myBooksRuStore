import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import {
	FlatList,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native'

import { NoteCard } from '@/components/notes/NoteCard'
import {
	EmptyState,
	LoadingState,
	Screen,
	SecondaryButton,
} from '@/components/ui'
import { diaryCopy } from '@/constants/copy'
import type { NoteType } from '@/constants/domain'
import { colors, radii, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import { getLibraryBookByEntryId } from '@/domain/libraryService'
import { listNotesForBook } from '@/domain/diaryService'
import type { LibraryBookItem, ReadingNote } from '@/db/types'

type Filter = 'ALL' | NoteType

const FILTERS: { key: Filter; label: string }[] = [
	{ key: 'ALL', label: diaryCopy.filterAll },
	{ key: 'QUOTE', label: diaryCopy.filterQuotes },
	{ key: 'THOUGHT', label: diaryCopy.filterThoughts },
	{ key: 'NOTE', label: diaryCopy.filterNotes },
]

/**
 * All notes for one book with type filters + search.
 */
export default function BookNotesScreen () {
	const { id } = useLocalSearchParams<{ id: string }>()
	const { executor } = useDatabase()
	const [item, setItem] = useState<LibraryBookItem | null>(null)
	const [notes, setNotes] = useState<ReadingNote[]>([])
	const [filter, setFilter] = useState<Filter>('ALL')
	const [search, setSearch] = useState('')
	const [loading, setLoading] = useState(true)

	const load = useCallback(async () => {
		if (!id) {
			return
		}
		setLoading(true)
		try {
			const book = await getLibraryBookByEntryId(executor, id)
			setItem(book)
			const types =
				filter === 'ALL' ? undefined : ([filter] as NoteType[])
			setNotes(
				await listNotesForBook(executor, id, {
					types,
					search,
					limit: 500,
				}),
			)
		} finally {
			setLoading(false)
		}
	}, [executor, id, filter, search])

	useFocusEffect(
		useCallback(() => {
			void load()
		}, [load]),
	)

	const openNew = useCallback((type: NoteType) => {
		if (!id) {
			return
		}
		router.push({
			pathname: '/notes/new',
			params: { entryId: id, type },
		})
	}, [id])

	const header = useMemo(
		() => (
			<View style={styles.header}>
				{item ? (
					<Text style={styles.book} numberOfLines={2}>
						{item.book.title}
					</Text>
				) : null}
				<TextInput
					accessibilityLabel={diaryCopy.searchPlaceholder}
					placeholder={diaryCopy.searchPlaceholder}
					placeholderTextColor={colors.muted}
					value={search}
					onChangeText={setSearch}
					style={styles.search}
				/>
				<View style={styles.filters}>
					{FILTERS.map((chip) => (
						<Pressable
							key={chip.key}
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
				<View style={styles.actions}>
					<SecondaryButton
						label={diaryCopy.addQuote}
						onPress={() => openNew('QUOTE')}
					/>
					<SecondaryButton
						label={diaryCopy.addThought}
						onPress={() => openNew('THOUGHT')}
					/>
					<SecondaryButton
						label={diaryCopy.addNoteShort}
						onPress={() => openNew('NOTE')}
					/>
				</View>
			</View>
		),
		[item, search, filter, openNew],
	)

	if (loading && !item) {
		return <LoadingState />
	}

	return (
		<>
			<Stack.Screen options={{ title: diaryCopy.allNotes, headerShown: true }} />
			<Screen contentStyle={styles.content}>
				{notes.length === 0 ? (
					<>
						{header}
						<EmptyState
							icon="create-outline"
							title={diaryCopy.notesEmpty}
							description={diaryCopy.emptyDescription}
							actionLabel={diaryCopy.addQuote}
							onAction={() => openNew('QUOTE')}
						/>
					</>
				) : (
					<FlatList
						data={notes}
						keyExtractor={(row) => row.id}
						ListHeaderComponent={header}
						renderItem={({ item: note }) => (
							<NoteCard
								note={note}
								progressMode={item?.entry.progressMode ?? 'PAGES'}
								onPress={() => router.push(`/notes/${note.id}`)}
							/>
						)}
						contentContainerStyle={styles.list}
					/>
				)}
			</Screen>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		flex: 1,
		paddingTop: spacing.md,
	},
	header: {
		gap: spacing.sm,
		marginBottom: spacing.md,
	},
	book: {
		...typography.section,
		color: colors.text,
	},
	search: {
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radii.md,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		backgroundColor: colors.surface,
		color: colors.text,
	},
	filters: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.xs,
	},
	chip: {
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
		borderRadius: radii.sm,
		backgroundColor: colors.surfaceMuted,
	},
	chipActive: {
		backgroundColor: colors.primarySoft,
	},
	chipLabel: {
		...typography.caption,
		color: colors.textSecondary,
	},
	chipLabelActive: {
		color: colors.primaryDark,
		fontWeight: '700',
	},
	actions: {
		gap: spacing.xs,
	},
	list: {
		paddingBottom: spacing.xxl,
	},
})
