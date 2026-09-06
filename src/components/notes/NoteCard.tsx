import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { NoteType, ProgressMode } from '@/constants/domain'
import { noteTypeLabels } from '@/constants/labels'
import { colors, radii, spacing, typography } from '@/constants/theme'
import type { ReadingNote } from '@/db/types'
import { formatNoteLocationLabel } from '@/domain/diaryService'

interface NoteCardProps {
	note: ReadingNote
	progressMode: ProgressMode
	bookTitle?: string
	onPress?: () => void
}

/**
 * Compact note preview — quotes get inset + emphasis, thoughts/notes stay calm.
 */
export function NoteCard ({
	note,
	progressMode,
	bookTitle,
	onPress,
}: NoteCardProps) {
	const location = formatNoteLocationLabel(note, progressMode)
	const meta = [noteTypeLabels[note.type as NoteType], location]
		.filter(Boolean)
		.join(' · ')

	const body = (
		<View
			style={[
				styles.card,
				note.type === 'QUOTE' ? styles.quoteCard : null,
			]}
		>
			{bookTitle ? (
				<Text style={styles.book} numberOfLines={1}>
					{bookTitle}
				</Text>
			) : null}
			<Text style={styles.meta}>{meta}</Text>
			<Text
				style={[
					styles.text,
					note.type === 'QUOTE' ? styles.quoteText : null,
				]}
				numberOfLines={5}
			>
				{note.type === 'QUOTE' ? `«${note.text}»` : note.text}
			</Text>
		</View>
	)

	if (!onPress) {
		return body
	}

	return (
		<Pressable
			accessibilityRole="button"
			onPress={onPress}
			style={({ pressed }) => (pressed ? styles.pressed : null)}
		>
			{body}
		</Pressable>
	)
}

const styles = StyleSheet.create({
	card: {
		backgroundColor: colors.surface,
		borderRadius: radii.md,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
		padding: spacing.sm,
		gap: 4,
		marginBottom: spacing.sm,
	},
	quoteCard: {
		borderLeftWidth: 3,
		borderLeftColor: colors.primary,
		paddingLeft: spacing.sm + 2,
	},
	pressed: {
		opacity: 0.85,
	},
	book: {
		...typography.bodySmall,
		fontWeight: '600',
		color: colors.text,
	},
	meta: {
		...typography.caption,
		color: colors.muted,
	},
	text: {
		...typography.body,
		color: colors.text,
	},
	quoteText: {
		fontStyle: 'italic',
		color: colors.textSecondary,
	},
})
