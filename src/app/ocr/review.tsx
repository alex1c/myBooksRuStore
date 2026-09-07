/**
 * OCR quote review / edit before save (Phase 11).
 * Saves only user-confirmed text as QUOTE — never raw silent OCR.
 */

import { router, Stack } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native'

import {
	PrimaryButton,
	Screen,
	SecondaryButton,
	SectionHeader,
	TextField,
} from '@/components/ui'
import { appCopy, ocrCopy } from '@/constants/copy'
import { colors, radii, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import { createNote } from '@/domain/diaryService'
import { getLibraryBookByEntryId } from '@/domain/libraryService'
import {
	clearPendingOcrDraft,
	joinOcrLines,
	peekPendingOcrDraft,
	resolveOcrEditorText,
	setPendingOcrDraft,
	takePendingOcrDraft,
} from '@/domain/ocr/ocrService'

export default function OcrReviewScreen () {
	const { executor } = useDatabase()
	const draft = useMemo(() => peekPendingOcrDraft(), [])
	const [text, setText] = useState(draft?.confirmedText ?? '')
	const [page, setPage] = useState(draft?.pageHint ?? '')
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [showPages, setShowPages] = useState(false)

	useEffect(() => {
		if (!draft?.entryId) {
			router.back()
			return
		}
		void (async () => {
			const book = await getLibraryBookByEntryId(executor, draft.entryId)
			setShowPages(book?.entry.progressMode === 'PAGES')
			if (
				book?.entry.progressMode === 'PAGES' &&
				!draft.pageHint &&
				book.entry.currentPage != null
			) {
				setPage(String(book.entry.currentPage))
			}
		})()
	}, [draft, executor])

	if (!draft?.entryId) {
		return null
	}

	const goRetake = () => {
		const current = peekPendingOcrDraft()
		router.replace({
			pathname: '/ocr/scan',
			params: {
				entryId: draft.entryId,
				sessionId: draft.sessionId ?? undefined,
				returnTo: draft.returnTo,
				pageHint: page || undefined,
				existingDraft: current?.existingDraft ?? draft.existingDraft,
			},
		})
	}

	const finishToEditor = (mode: 'replace' | 'append') => {
		const next = resolveOcrEditorText(draft.existingDraft, text, mode)
		setPendingOcrDraft({
			...draft,
			confirmedText: next,
			applyMode: mode,
		})
		router.replace({
			pathname: '/notes/new',
			params: {
				entryId: draft.entryId,
				type: 'QUOTE',
				sessionId: draft.sessionId ?? undefined,
				returnTo: draft.returnTo === 'session' ? 'session' : undefined,
				ocrApplied: '1',
			},
		})
	}

	const handleConfirm = async () => {
		const trimmed = text.trim()
		if (!trimmed) {
			setError('Введите текст цитаты')
			return
		}
		setError(null)

		// Return into quote editor when user started from it (with or without draft).
		if (draft.returnTo === 'editor') {
			if (draft.existingDraft.trim()) {
				Alert.alert(ocrCopy.existingDraftTitle, ocrCopy.existingDraftMessage, [
					{
						text: ocrCopy.replaceDraft,
						onPress: () => finishToEditor('replace'),
					},
					{
						text: ocrCopy.appendDraft,
						onPress: () => finishToEditor('append'),
					},
					{ text: appCopy.cancel, style: 'cancel' },
				])
				return
			}
			finishToEditor('replace')
			return
		}

		setSaving(true)
		try {
			let pageValue: number | null = null
			if (showPages && page.trim()) {
				pageValue = Number.parseInt(page, 10)
			}
			await createNote(executor, {
				libraryEntryId: draft.entryId,
				type: 'QUOTE',
				text: trimmed,
				readingSessionId: draft.sessionId,
				page: pageValue,
			})
			clearPendingOcrDraft()
			if (draft.returnTo === 'session') {
				router.replace('/sessions/active')
			} else {
				router.replace(`/books/${draft.entryId}`)
			}
		} catch (err) {
			const message =
				err instanceof Error ? err.message : 'Не удалось сохранить'
			setError(message.replace(/^INVALID_NOTE:/, ''))
		} finally {
			setSaving(false)
		}
	}

	return (
		<>
			<Stack.Screen options={{ title: ocrCopy.reviewTitle, headerShown: true }} />
			<Screen scroll keyboardAvoiding contentStyle={styles.content}>
				<SectionHeader
					title={ocrCopy.reviewTitle}
					subtitle={ocrCopy.reviewHint}
				/>
				<Text style={styles.privacy}>{ocrCopy.privacy}</Text>
				<TextInput
					accessibilityLabel={ocrCopy.reviewTitle}
					value={text}
					onChangeText={setText}
					multiline
					textAlignVertical="top"
					style={[styles.input, error ? styles.inputError : null]}
				/>
				{error ? <Text style={styles.error}>{error}</Text> : null}

				{showPages ? (
					<TextField
						label={ocrCopy.pageLabel}
						value={page}
						onChangeText={setPage}
						keyboardType="number-pad"
						placeholder="Необязательно"
					/>
				) : null}

				<View style={styles.row}>
					<SecondaryButton
						label={ocrCopy.joinLines}
						onPress={() => setText(joinOcrLines(text))}
					/>
				</View>

				<PrimaryButton
					label={
						draft.returnTo === 'editor'
							? ocrCopy.useText
							: ocrCopy.saveQuote
					}
					onPress={() => {
						void handleConfirm()
					}}
					loading={saving}
				/>
				<SecondaryButton label={ocrCopy.retake} onPress={goRetake} />
				<SecondaryButton
					label={ocrCopy.manualEntry}
					onPress={() => {
						takePendingOcrDraft()
						router.replace({
							pathname: '/notes/new',
							params: {
								entryId: draft.entryId,
								type: 'QUOTE',
								sessionId: draft.sessionId ?? undefined,
								returnTo:
									draft.returnTo === 'session' ? 'session' : undefined,
							},
						})
					}}
				/>
			</Screen>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		gap: spacing.md,
		paddingBottom: spacing.xxl,
	},
	privacy: {
		...typography.bodySmall,
		color: colors.muted,
	},
	input: {
		minHeight: 200,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radii.md,
		padding: spacing.md,
		backgroundColor: colors.surface,
		color: colors.text,
		fontSize: typography.body.fontSize,
		lineHeight: 22,
	},
	inputError: {
		borderColor: colors.danger,
	},
	error: {
		...typography.caption,
		color: colors.danger,
	},
	row: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.sm,
	},
})
