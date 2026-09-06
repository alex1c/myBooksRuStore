import * as Clipboard from 'expo-clipboard'
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert, Share, StyleSheet, Text, View } from 'react-native'

import {
	LoadingState,
	PrimaryButton,
	Screen,
	SecondaryButton,
} from '@/components/ui'
import { appCopy, diaryCopy } from '@/constants/copy'
import { noteTypeLabels } from '@/constants/labels'
import { colors, radii, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import {
	deleteNote,
	formatNoteLocationLabel,
	getNoteWithBook,
	type NoteWithBook,
} from '@/domain/diaryService'
import { formatDiaryDateTime } from '@/utils/diaryDates'

/**
 * Note details — view, copy, share, edit, delete.
 */
export default function NoteDetailsScreen () {
	const { id } = useLocalSearchParams<{ id: string }>()
	const { executor } = useDatabase()
	const [bundle, setBundle] = useState<NoteWithBook | null>(null)
	const [loading, setLoading] = useState(true)

	const load = useCallback(async () => {
		if (!id) {
			return
		}
		setLoading(true)
		try {
			setBundle(await getNoteWithBook(executor, id))
		} finally {
			setLoading(false)
		}
	}, [executor, id])

	useFocusEffect(
		useCallback(() => {
			void load()
		}, [load]),
	)

	if (loading && !bundle) {
		return <LoadingState />
	}

	if (!bundle) {
		return (
			<>
				<Stack.Screen options={{ title: diaryCopy.noteDetails, headerShown: true }} />
				<Screen>
					<Text style={styles.missing}>Запись не найдена</Text>
				</Screen>
			</>
		)
	}

	const { note, item } = bundle
	const location = formatNoteLocationLabel(note, item.entry.progressMode)

	const handleDelete = () => {
		Alert.alert(diaryCopy.deleteTitle, diaryCopy.deleteMessage, [
			{ text: appCopy.cancel, style: 'cancel' },
			{
				text: diaryCopy.deleteConfirm,
				style: 'destructive',
				onPress: () => {
					void (async () => {
						await deleteNote(executor, note.id)
						router.back()
					})()
				},
			},
		])
	}

	const handleCopy = async () => {
		await Clipboard.setStringAsync(note.text)
		Alert.alert(diaryCopy.copied)
	}

	const handleShare = async () => {
		await Share.share({ message: note.text })
	}

	return (
		<>
			<Stack.Screen options={{ title: diaryCopy.noteDetails, headerShown: true }} />
			<Screen scroll contentStyle={styles.content}>
				<Text style={styles.book}>{item.book.title}</Text>
				<Text style={styles.meta}>
					{[noteTypeLabels[note.type], location, formatDiaryDateTime(note.createdAt)]
						.filter(Boolean)
						.join(' · ')}
				</Text>

				<View
					style={[
						styles.body,
						note.type === 'QUOTE' ? styles.quoteBody : null,
					]}
				>
					<Text
						style={[
							styles.text,
							note.type === 'QUOTE' ? styles.quoteText : null,
						]}
					>
						{note.type === 'QUOTE' ? `«${note.text}»` : note.text}
					</Text>
				</View>

				{note.readingSessionId ? (
					<Text style={styles.session}>{diaryCopy.linkedSessionPast}</Text>
				) : null}

				<PrimaryButton
					label={appCopy.edit}
					onPress={() => router.push(`/notes/${note.id}/edit`)}
				/>
				<SecondaryButton label={diaryCopy.copy} onPress={() => void handleCopy()} />
				<SecondaryButton label={diaryCopy.share} onPress={() => void handleShare()} />
				<SecondaryButton label={diaryCopy.deleteConfirm} onPress={handleDelete} />
			</Screen>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		gap: spacing.md,
		paddingBottom: spacing.xxl,
	},
	book: {
		...typography.section,
		color: colors.text,
	},
	meta: {
		...typography.bodySmall,
		color: colors.muted,
		marginTop: -spacing.sm,
	},
	body: {
		backgroundColor: colors.surface,
		borderRadius: radii.lg,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
		padding: spacing.md,
	},
	quoteBody: {
		borderLeftWidth: 3,
		borderLeftColor: colors.primary,
	},
	text: {
		...typography.body,
		color: colors.text,
		lineHeight: 24,
	},
	quoteText: {
		fontStyle: 'italic',
		color: colors.textSecondary,
	},
	session: {
		...typography.bodySmall,
		color: colors.primaryDark,
	},
	missing: {
		...typography.body,
		color: colors.textSecondary,
	},
})
