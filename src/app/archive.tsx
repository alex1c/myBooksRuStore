import { router, Stack, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'

import { LibraryBookCard } from '@/components/library/LibraryBookCard'
import {
	EmptyState,
	FeedbackSnackbar,
	LoadingState,
	Screen,
	SecondaryButton,
	SectionHeader,
} from '@/components/ui'
import { archiveCopy, appCopy } from '@/constants/copy'
import { spacing } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import {
	listLibraryBooks,
	restoreLibraryBook,
} from '@/domain/libraryService'
import type { LibraryBookItem } from '@/db/types'

/**
 * Archived library entries with restore action (no hard delete in UI).
 */
export default function ArchiveScreen () {
	const { executor } = useDatabase()
	const [items, setItems] = useState<LibraryBookItem[]>([])
	const [loading, setLoading] = useState(true)
	const [snack, setSnack] = useState<string | null>(null)

	const load = useCallback(async () => {
		setLoading(true)
		try {
			const rows = await listLibraryBooks(executor, {
				archived: true,
				sort: 'RECENTLY_UPDATED',
			})
			setItems(rows)
		} finally {
			setLoading(false)
		}
	}, [executor])

	useFocusEffect(
		useCallback(() => {
			void load()
		}, [load]),
	)

	const handleRestore = (entryId: string) => {
		void (async () => {
			await restoreLibraryBook(executor, entryId)
			setSnack(archiveCopy.restored)
			await load()
		})()
	}

	return (
		<>
			<Stack.Screen options={{ title: archiveCopy.title, headerShown: true }} />
			<Screen contentStyle={styles.content}>
				<SectionHeader title={archiveCopy.title} />
				{loading && items.length === 0 ? <LoadingState /> : null}
				{!loading && items.length === 0 ? (
					<View style={styles.empty}>
						<EmptyState
							icon="archive-outline"
							title={archiveCopy.emptyTitle}
							description={archiveCopy.emptyDescription}
						/>
					</View>
				) : null}
				<FlatList
					data={items}
					keyExtractor={(item) => item.entry.id}
					renderItem={({ item }) => (
						<View style={styles.row}>
							<LibraryBookCard
								item={item}
								onPress={() => router.push(`/books/${item.entry.id}`)}
							/>
							<SecondaryButton
								label={appCopy.restore}
								onPress={() => handleRestore(item.entry.id)}
							/>
						</View>
					)}
					contentContainerStyle={styles.list}
				/>
				{snack ? (
					<View style={styles.snackWrap}>
						<FeedbackSnackbar
							message={snack}
							onDismiss={() => setSnack(null)}
						/>
					</View>
				) : null}
			</Screen>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		flex: 1,
		paddingBottom: 0,
	},
	empty: {
		flex: 1,
		justifyContent: 'center',
	},
	list: {
		paddingBottom: spacing.xxl,
	},
	row: {
		gap: spacing.xs,
		marginBottom: spacing.sm,
	},
	snackWrap: {
		position: 'absolute',
		left: spacing.md,
		right: spacing.md,
		bottom: spacing.lg,
	},
})
