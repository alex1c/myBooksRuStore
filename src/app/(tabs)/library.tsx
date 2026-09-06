import { router, useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import {
	FlatList,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native'

import { ChipScroller } from '@/components/library/ChipScroller'
import { LibraryBookCard } from '@/components/library/LibraryBookCard'
import {
	EmptyState,
	LoadingState,
	PrimaryButton,
	Screen,
	SectionHeader,
	TextField,
} from '@/components/ui'
import { libraryCopy } from '@/constants/copy'
import type { LibrarySort, LibraryStatus } from '@/constants/domain'
import { LIBRARY_SORTS } from '@/constants/domain'
import {
	sortLabels,
	statusFilterLabels,
} from '@/constants/labels'
import { colors, radii, spacing, touchTarget, typography } from '@/constants/theme'
import { useLibraryList } from '@/hooks/useLibraryList'

const STATUS_FILTERS: (LibraryStatus | 'ALL')[] = [
	'ALL',
	'READING',
	'WANT_TO_READ',
	'FINISHED',
	'PAUSED',
	'ABANDONED',
]

/**
 * Library tab — searchable, filterable, sortable list of local books.
 */
export default function LibraryScreen () {
	const {
		items,
		counts,
		loading,
		searchInput,
		setSearchInput,
		status,
		setStatus,
		sort,
		setSort,
		reload,
	} = useLibraryList()
	const [sortOpen, setSortOpen] = useState(false)

	useFocusEffect(
		useCallback(() => {
			reload()
		}, [reload]),
	)

	const filterOptions = useMemo(
		() =>
			STATUS_FILTERS.map((value) => ({
				value,
				label: statusFilterLabels[value],
			})),
		[],
	)

	const isGloballyEmpty = counts.all === 0 && !searchInput.trim()
	const isFilterEmpty = !isGloballyEmpty && items.length === 0

	return (
		<Screen contentStyle={styles.screenContent}>
			<View style={styles.headerRow}>
				<SectionHeader title={libraryCopy.title} />
				<PrimaryButton
					label={libraryCopy.addBookShort}
					onPress={() => router.push('/books/add')}
					style={styles.addButton}
					accessibilityLabel={libraryCopy.addBook}
				/>
			</View>

			{!isGloballyEmpty ? (
				<>
					<TextField
						placeholder={libraryCopy.searchPlaceholder}
						value={searchInput}
						onChangeText={setSearchInput}
						autoCapitalize="none"
						autoCorrect={false}
						clearButtonMode="while-editing"
						style={styles.search}
					/>
					<ChipScroller
						options={filterOptions}
						value={status}
						onChange={setStatus}
						accessibilityLabel="Фильтр по статусу"
					/>
					<View style={styles.metaRow}>
						<Text style={styles.counts} numberOfLines={1}>
							{libraryCopy.countsReading} {counts.READING}
							{' · '}
							{libraryCopy.countsWant} {counts.WANT_TO_READ}
							{' · '}
							{libraryCopy.countsFinished} {counts.FINISHED}
						</Text>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={libraryCopy.sort}
							onPress={() => setSortOpen(true)}
							style={styles.sortButton}
						>
							<Text style={styles.sortLabel}>{libraryCopy.sort}</Text>
						</Pressable>
					</View>
				</>
			) : null}

			{loading && items.length === 0 ? (
				<LoadingState message={libraryCopy.title} />
			) : null}

			{isGloballyEmpty && !loading ? (
				<View style={styles.emptyWrap}>
					<EmptyState
						icon="library-outline"
						title={libraryCopy.emptyTitle}
						description={libraryCopy.emptyDescription}
						actionLabel={libraryCopy.addBook}
						onAction={() => router.push('/books/add')}
					/>
				</View>
			) : null}

			{isFilterEmpty ? (
				<View style={styles.emptyWrap}>
					<EmptyState
						icon="search-outline"
						title={libraryCopy.filterEmpty(
							statusFilterLabels[status],
						)}
					/>
				</View>
			) : null}

			{!isGloballyEmpty && !isFilterEmpty ? (
				<FlatList
					data={items}
					keyExtractor={(item) => item.entry.id}
					renderItem={({ item }) => (
						<LibraryBookCard
							item={item}
							onPress={() => router.push(`/books/${item.entry.id}`)}
						/>
					)}
					contentContainerStyle={styles.list}
					showsVerticalScrollIndicator={false}
					initialNumToRender={12}
					windowSize={7}
					keyboardShouldPersistTaps="handled"
				/>
			) : null}

			<Modal
				visible={sortOpen}
				transparent
				animationType="fade"
				onRequestClose={() => setSortOpen(false)}
			>
				<Pressable style={styles.modalBackdrop} onPress={() => setSortOpen(false)}>
					<View style={styles.modalCard}>
						<Text style={styles.modalTitle}>{libraryCopy.sort}</Text>
						{LIBRARY_SORTS.map((option) => (
							<Pressable
								key={option}
								accessibilityRole="button"
								accessibilityState={{ selected: sort === option }}
								onPress={() => {
									setSort(option as LibrarySort)
									setSortOpen(false)
								}}
								style={styles.modalRow}
							>
								<Text
									style={[
										styles.modalRowLabel,
										sort === option && styles.modalRowSelected,
									]}
								>
									{sortLabels[option]}
								</Text>
							</Pressable>
						))}
					</View>
				</Pressable>
			</Modal>
		</Screen>
	)
}

const styles = StyleSheet.create({
	screenContent: {
		flex: 1,
		paddingBottom: 0,
	},
	headerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: spacing.sm,
	},
	addButton: {
		paddingHorizontal: spacing.md,
		minHeight: touchTarget.min - 4,
		alignSelf: 'center',
	},
	search: {
		marginTop: spacing.xs,
	},
	metaRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: spacing.sm,
		marginBottom: spacing.xs,
	},
	counts: {
		...typography.caption,
		color: colors.muted,
		flex: 1,
	},
	sortButton: {
		minHeight: touchTarget.min - 8,
		justifyContent: 'center',
		paddingHorizontal: spacing.xs,
	},
	sortLabel: {
		...typography.bodySmall,
		color: colors.primary,
		fontWeight: '600',
	},
	list: {
		paddingBottom: spacing.xl,
	},
	emptyWrap: {
		flex: 1,
		justifyContent: 'center',
		paddingVertical: spacing.xl,
	},
	modalBackdrop: {
		flex: 1,
		backgroundColor: colors.overlay,
		justifyContent: 'flex-end',
	},
	modalCard: {
		backgroundColor: colors.surface,
		borderTopLeftRadius: radii.xl,
		borderTopRightRadius: radii.xl,
		padding: spacing.lg,
		gap: spacing.xs,
	},
	modalTitle: {
		...typography.section,
		marginBottom: spacing.sm,
	},
	modalRow: {
		minHeight: touchTarget.min,
		justifyContent: 'center',
	},
	modalRowLabel: {
		...typography.body,
		color: colors.text,
	},
	modalRowSelected: {
		color: colors.primary,
		fontWeight: '700',
	},
})
