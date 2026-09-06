import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'

import { LibraryBookCard } from '@/components/library/LibraryBookCard'
import {
	EmptyState,
	LoadingState,
	Screen,
	SectionHeader,
} from '@/components/ui'
import { todayCopy } from '@/constants/copy'
import { spacing } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import { listReadingNow } from '@/domain/libraryService'
import type { LibraryBookItem } from '@/db/types'

/**
 * Today tab — shows real READING books from SQLite (no timer yet).
 */
export default function TodayScreen () {
	const { executor } = useDatabase()
	const [items, setItems] = useState<LibraryBookItem[]>([])
	const [loading, setLoading] = useState(true)

	const load = useCallback(async () => {
		setLoading(true)
		try {
			setItems(await listReadingNow(executor))
		} finally {
			setLoading(false)
		}
	}, [executor])

	useFocusEffect(
		useCallback(() => {
			void load()
		}, [load]),
	)

	return (
		<Screen contentStyle={styles.content}>
			<SectionHeader title={todayCopy.title} />
			{loading && items.length === 0 ? <LoadingState /> : null}
			{!loading && items.length === 0 ? (
				<View style={styles.empty}>
					<EmptyState
						icon="sunny-outline"
						title={todayCopy.emptyTitle}
						description={todayCopy.emptyDescription}
						actionLabel={todayCopy.chooseFromLibrary}
						onAction={() => router.push('/(tabs)/library')}
						secondaryActionLabel={todayCopy.addBook}
						onSecondaryAction={() => router.push('/books/add')}
					/>
				</View>
			) : null}
			{items.length > 0 ? (
				<>
					<SectionHeader title={todayCopy.readingSection} />
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
					/>
				</>
			) : null}
		</Screen>
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
		paddingVertical: spacing.xl,
	},
	list: {
		paddingBottom: spacing.xl,
	},
})
