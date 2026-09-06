import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'

import { CoverThumbnail } from '@/components/library/CoverThumbnail'
import {
	Card,
	LoadingState,
	PrimaryButton,
	Screen,
	SecondaryButton,
} from '@/components/ui'
import { appCopy, bookDetailsCopy } from '@/constants/copy'
import {
	formatLabels,
	statusLabels,
} from '@/constants/labels'
import { colors, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import {
	archiveLibraryBook,
	getLibraryBookByEntryId,
	listShelves,
} from '@/domain/libraryService'
import type { LibraryBookItem, Shelf } from '@/db/types'
import { formatProgressLabel } from '@/utils/progress'

/**
 * Book details — catalog + personal library state + archive action.
 */
export default function BookDetailsScreen () {
	const { id } = useLocalSearchParams<{ id: string }>()
	const { executor } = useDatabase()
	const [item, setItem] = useState<LibraryBookItem | null>(null)
	const [shelves, setShelves] = useState<Shelf[]>([])
	const [loading, setLoading] = useState(true)

	const load = useCallback(async () => {
		if (!id) {
			return
		}
		setLoading(true)
		try {
			const [next, shelfRows] = await Promise.all([
				getLibraryBookByEntryId(executor, id),
				listShelves(executor),
			])
			setItem(next)
			setShelves(shelfRows)
		} finally {
			setLoading(false)
		}
	}, [executor, id])

	useFocusEffect(
		useCallback(() => {
			void load()
		}, [load]),
	)

	const handleArchive = () => {
		if (!item) {
			return
		}
		Alert.alert(bookDetailsCopy.archiveTitle, bookDetailsCopy.archiveMessage, [
			{ text: appCopy.cancel, style: 'cancel' },
			{
				text: bookDetailsCopy.archiveConfirm,
				style: 'destructive',
				onPress: () => {
					void (async () => {
						await archiveLibraryBook(executor, item.entry.id)
						router.replace('/(tabs)/library')
					})()
				},
			},
		])
	}

	if (loading && !item) {
		return <LoadingState />
	}

	if (!item) {
		return (
			<Screen>
				<Text style={styles.missing}>Книга не найдена</Text>
			</Screen>
		)
	}

	const author = item.book.authorText.trim() || appCopy.authorUnknown
	const progress = formatProgressLabel(item.entry)
	const shelfNames = shelves
		.filter((shelf) => item.shelfIds.includes(shelf.id))
		.map((shelf) => shelf.name)

	const finishedLabel = (() => {
		const e = item.entry
		if (e.status !== 'FINISHED') {
			return null
		}
		if (e.finishedDatePrecision === 'EXACT' && e.finishedOn) {
			return e.finishedOn
		}
		if (e.finishedDatePrecision === 'YEAR' && e.finishedYear != null) {
			return String(e.finishedYear)
		}
		if (e.finishedDatePrecision === 'UNKNOWN') {
			return 'Раньше'
		}
		return null
	})()

	return (
		<>
			<Stack.Screen options={{ title: item.book.title, headerShown: true }} />
			<Screen scroll contentStyle={styles.content}>
				<View style={styles.hero}>
					<CoverThumbnail
						title={item.book.title}
						coverUri={item.book.coverUri}
						remoteCoverUrl={item.book.remoteCoverUrl}
						size={88}
					/>
					<View style={styles.heroText}>
						<Text style={styles.title}>{item.book.title}</Text>
						{item.book.subtitle ? (
							<Text style={styles.subtitle}>{item.book.subtitle}</Text>
						) : null}
						<Text style={styles.author}>{author}</Text>
						<Text style={styles.meta}>
							{statusLabels[item.entry.status]} · {formatLabels[item.entry.format]}
						</Text>
					</View>
				</View>

				<Card style={styles.card}>
					<Text style={styles.section}>{bookDetailsCopy.progress}</Text>
					<Text style={styles.body}>
						{progress ?? bookDetailsCopy.noProgress}
					</Text>
					{item.entry.rating != null ? (
						<Text style={styles.body}>★ {item.entry.rating}</Text>
					) : (
						<Text style={styles.muted}>{bookDetailsCopy.noRating}</Text>
					)}
					{finishedLabel ? (
						<Text style={styles.body}>Прочитано: {finishedLabel}</Text>
					) : null}
					{item.entry.reviewText ? (
						<Text style={styles.review}>{item.entry.reviewText}</Text>
					) : null}
				</Card>

				{(item.book.isbn13 ||
					item.book.isbn10 ||
					item.book.publisher ||
					item.book.publishedYear ||
					item.book.pageCount ||
					item.book.description) ? (
					<Card style={styles.card}>
						<Text style={styles.section}>{bookDetailsCopy.metadata}</Text>
						{item.book.isbn13 ? (
							<Text style={styles.body}>ISBN-13: {item.book.isbn13}</Text>
						) : null}
						{item.book.isbn10 ? (
							<Text style={styles.body}>ISBN-10: {item.book.isbn10}</Text>
						) : null}
						{item.book.publisher ? (
							<Text style={styles.body}>{item.book.publisher}</Text>
						) : null}
						{item.book.publishedYear ? (
							<Text style={styles.body}>{item.book.publishedYear}</Text>
						) : null}
						{item.book.pageCount ? (
							<Text style={styles.body}>{item.book.pageCount} стр.</Text>
						) : null}
						{item.book.description ? (
							<Text style={styles.body}>{item.book.description}</Text>
						) : null}
					</Card>
				) : null}

				{shelfNames.length > 0 ? (
					<Card style={styles.card}>
						<Text style={styles.section}>{bookDetailsCopy.shelves}</Text>
						<Text style={styles.body}>{shelfNames.join(' · ')}</Text>
					</Card>
				) : null}

				<PrimaryButton
					label={appCopy.edit}
					onPress={() => router.push(`/books/${item.entry.id}/edit`)}
				/>
				<SecondaryButton label={appCopy.archive} onPress={handleArchive} />
			</Screen>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		gap: spacing.md,
		paddingTop: spacing.md,
		paddingBottom: spacing.xxl,
	},
	hero: {
		flexDirection: 'row',
		gap: spacing.md,
		alignItems: 'flex-start',
	},
	heroText: {
		flex: 1,
		gap: spacing.xxs,
		minWidth: 0,
	},
	title: {
		...typography.title,
		fontSize: 24,
		lineHeight: 30,
	},
	subtitle: {
		...typography.body,
		color: colors.textSecondary,
	},
	author: {
		...typography.body,
		color: colors.textSecondary,
	},
	meta: {
		...typography.bodySmall,
		color: colors.muted,
		marginTop: spacing.xxs,
	},
	card: {
		gap: spacing.xs,
	},
	section: {
		...typography.section,
	},
	body: {
		...typography.body,
		color: colors.text,
	},
	muted: {
		...typography.bodySmall,
		color: colors.muted,
	},
	review: {
		...typography.body,
		color: colors.textSecondary,
		marginTop: spacing.xs,
	},
	missing: {
		...typography.body,
		color: colors.textSecondary,
		marginTop: spacing.xl,
		textAlign: 'center',
	},
})
