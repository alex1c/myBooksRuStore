import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert, StyleSheet } from 'react-native'

import {
	BookForm,
	emptyBookFormValues,
	type ParsedBookForm,
} from '@/components/library/BookForm'
import { Screen, SectionHeader } from '@/components/ui'
import { addBookCopy } from '@/constants/copy'
import { useDatabase } from '@/context/DatabaseContext'
import {
	addBookToLibrary,
	findLibraryDuplicates,
	listShelves,
} from '@/domain/libraryService'
import type { Shelf } from '@/db/types'
import { spacing } from '@/constants/theme'

/**
 * Add-book screen — minimal required fields, optional details expandable.
 */
export default function AddBookScreen () {
	const { executor } = useDatabase()
	const [shelves, setShelves] = useState<Shelf[]>([])

	useFocusEffect(
		useCallback(() => {
			let cancelled = false
			void listShelves(executor).then((rows) => {
				if (!cancelled) {
					setShelves(rows)
				}
			})
			return () => {
				cancelled = true
			}
		}, [executor]),
	)

	const persist = async (data: ParsedBookForm, forceAdd = false) => {
		if (!forceAdd) {
			const duplicates = await findLibraryDuplicates(executor, {
				title: data.book.title,
				authorText: data.book.authorText,
				isbn10: data.book.isbn10,
				isbn13: data.book.isbn13,
			})
			if (duplicates.hasDuplicates) {
				const first = duplicates.matches[0]
				Alert.alert(
					addBookCopy.duplicateTitle,
					first
						? `${first.book.title}${first.book.authorText ? ` — ${first.book.authorText}` : ''}`
						: undefined,
					[
						{ text: addBookCopy.duplicateAddAnyway, onPress: () => {
							void persist(data, true)
						} },
						...(first
							? [{
								text: addBookCopy.duplicateOpen,
								onPress: () => router.replace(`/books/${first.entry.id}`),
							}]
							: []),
						{ text: 'Отмена', style: 'cancel' as const },
					],
				)
				return
			}
		}

		const created = await addBookToLibrary(executor, {
			book: data.book,
			entry: data.entry,
			shelfIds: data.shelfIds,
			forceAdd,
		})
		router.replace(`/books/${created.entry.id}`)
	}

	return (
		<Screen scroll keyboardAvoiding contentStyle={styles.content}>
			<SectionHeader title={addBookCopy.title} />
			<BookForm
				initial={emptyBookFormValues()}
				shelves={shelves}
				submitLabel={addBookCopy.submitAdd}
				onSubmit={(data) => persist(data)}
				onCancel={() => router.back()}
			/>
		</Screen>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingTop: spacing.sm,
	},
})
