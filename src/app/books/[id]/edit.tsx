import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useState } from 'react'
import { StyleSheet } from 'react-native'

import {
	BookForm,
	valuesFromLibraryItem,
	type ParsedBookForm,
} from '@/components/library/BookForm'
import { LoadingState, Screen, SectionHeader } from '@/components/ui'
import { addBookCopy } from '@/constants/copy'
import { spacing } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import {
	getLibraryBookByEntryId,
	listShelves,
	updateLibraryBook,
} from '@/domain/libraryService'
import type { LibraryBookItem, Shelf } from '@/db/types'

/**
 * Edit book + library entry fields and shelf membership.
 */
export default function EditBookScreen () {
	const { id } = useLocalSearchParams<{ id: string }>()
	const { executor } = useDatabase()
	const [item, setItem] = useState<LibraryBookItem | null>(null)
	const [shelves, setShelves] = useState<Shelf[]>([])
	const [loading, setLoading] = useState(true)

	useFocusEffect(
		useCallback(() => {
			let cancelled = false
			async function load () {
				if (!id) {
					return
				}
				setLoading(true)
				try {
					const [next, shelfRows] = await Promise.all([
						getLibraryBookByEntryId(executor, id),
						listShelves(executor),
					])
					if (!cancelled) {
						setItem(next)
						setShelves(shelfRows)
					}
				} finally {
					if (!cancelled) {
						setLoading(false)
					}
				}
			}
			void load()
			return () => {
				cancelled = true
			}
		}, [executor, id]),
	)

	const handleSubmit = async (data: ParsedBookForm) => {
		if (!id) {
			return
		}
		await updateLibraryBook(executor, {
			entryId: id,
			book: data.book,
			entry: data.entry,
			shelfIds: data.shelfIds,
		})
		router.back()
	}

	if (loading || !item) {
		return <LoadingState />
	}

	return (
		<>
			<Stack.Screen options={{ title: addBookCopy.editTitle, headerShown: true }} />
			<Screen scroll keyboardAvoiding contentStyle={styles.content}>
				<SectionHeader title={addBookCopy.editTitle} />
				<BookForm
					initial={valuesFromLibraryItem(item)}
					shelves={shelves}
					submitLabel={addBookCopy.submitSave}
					onSubmit={handleSubmit}
					onCancel={() => router.back()}
				/>
			</Screen>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingTop: spacing.sm,
	},
})
