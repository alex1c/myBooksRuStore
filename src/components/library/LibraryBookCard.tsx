import { Pressable, StyleSheet, Text, View } from 'react-native'

import { CoverThumbnail } from '@/components/library/CoverThumbnail'
import { appCopy } from '@/constants/copy'
import { formatLabels, statusLabels } from '@/constants/labels'
import { colors, radii, spacing, typography } from '@/constants/theme'
import type { LibraryBookItem } from '@/db/types'
import { formatProgressLabel } from '@/utils/progress'

interface LibraryBookCardProps {
	item: LibraryBookItem
	onPress: () => void
}

/**
 * Compact library list card: cover, title, author, status, format, progress.
 */
export function LibraryBookCard ({ item, onPress }: LibraryBookCardProps) {
	const { book, entry } = item
	const author = book.authorText.trim() || appCopy.authorUnknown
	const progress = formatProgressLabel(entry)
	const showRating =
		entry.status === 'FINISHED' && entry.rating != null

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${book.title}, ${author}`}
			onPress={onPress}
			style={({ pressed }) => [styles.card, pressed && styles.pressed]}
		>
			<CoverThumbnail title={book.title} coverUri={book.coverUri} remoteCoverUrl={book.remoteCoverUrl} size={52} />
			<View style={styles.body}>
				<Text style={styles.title} numberOfLines={2}>
					{book.title}
				</Text>
				<Text style={styles.author} numberOfLines={1}>
					{author}
				</Text>
				<View style={styles.metaRow}>
					<Text style={styles.meta}>{statusLabels[entry.status]}</Text>
					<Text style={styles.dot}>·</Text>
					<Text style={styles.meta}>{formatLabels[entry.format]}</Text>
					{showRating ? (
						<>
							<Text style={styles.dot}>·</Text>
							<Text style={styles.meta}>★ {entry.rating}</Text>
						</>
					) : null}
				</View>
				{progress ? (
					<Text style={styles.progress} numberOfLines={1}>
						{progress}
					</Text>
				) : null}
			</View>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	card: {
		flexDirection: 'row',
		gap: spacing.sm,
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.md,
		backgroundColor: colors.surface,
		borderRadius: radii.lg,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
		marginBottom: spacing.sm,
	},
	pressed: {
		backgroundColor: colors.surfaceMuted,
	},
	body: {
		flex: 1,
		gap: 2,
		justifyContent: 'center',
		minWidth: 0,
	},
	title: {
		...typography.section,
		fontSize: 16,
		lineHeight: 22,
		color: colors.text,
	},
	author: {
		...typography.bodySmall,
		color: colors.textSecondary,
	},
	metaRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		alignItems: 'center',
		gap: 4,
		marginTop: 2,
	},
	meta: {
		...typography.caption,
		color: colors.muted,
	},
	dot: {
		...typography.caption,
		color: colors.border,
	},
	progress: {
		...typography.bodySmall,
		color: colors.primaryDark,
		marginTop: 2,
	},
})
