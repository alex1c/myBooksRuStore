import { router, Stack, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native'

import { NoteTypeChips } from '@/components/notes/NoteTypeChips'
import {
	PrimaryButton,
	Screen,
	SecondaryButton,
	TextField,
} from '@/components/ui'
import { appCopy, diaryCopy } from '@/constants/copy'
import type { NoteType } from '@/constants/domain'
import { isNoteType } from '@/constants/domain'
import { colors, radii, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import { getLibraryBookByEntryId } from '@/domain/libraryService'
import {
	createNote,
	notePlaceholder,
} from '@/domain/diaryService'
import { getActiveSession } from '@/db/repositories/readingSessions'
import type { LibraryBookItem } from '@/db/types'
import {
	hoursMinutesToSeconds,
	secondsToHoursMinutes,
} from '@/utils/progress'

/**
 * Create quote / thought / note — fast path with optional location + session link.
 */
export default function NewNoteScreen () {
	const { executor } = useDatabase()
	const navigation = useNavigation()
	const params = useLocalSearchParams<{
		entryId?: string
		type?: string
		sessionId?: string
		returnTo?: string
	}>()

	const initialType: NoteType = isNoteType(params.type ?? '')
		? (params.type as NoteType)
		: 'QUOTE'

	const [item, setItem] = useState<LibraryBookItem | null>(null)
	const [type, setType] = useState<NoteType>(initialType)
	const [text, setText] = useState('')
	const [page, setPage] = useState('')
	const [percent, setPercent] = useState('')
	const [hours, setHours] = useState('')
	const [minutes, setMinutes] = useState('')
	const [sessionId, setSessionId] = useState<string | null>(
		params.sessionId ?? null,
	)
	const [error, setError] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)
	const [dirty, setDirty] = useState(false)

	const entryId = params.entryId

	const load = useCallback(async () => {
		if (!entryId) {
			return
		}
		const book = await getLibraryBookByEntryId(executor, entryId)
		setItem(book)
		if (!book) {
			return
		}

		// Smart default location from current book progress.
		if (book.entry.progressMode === 'PAGES' && book.entry.currentPage != null) {
			setPage(String(book.entry.currentPage))
		} else if (
			book.entry.progressMode === 'PERCENT' &&
			book.entry.currentPercent != null
		) {
			setPercent(String(Math.round(book.entry.currentPercent)))
		} else if (
			book.entry.progressMode === 'TIME' &&
			book.entry.audioPositionSeconds != null
		) {
			const hm = secondsToHoursMinutes(book.entry.audioPositionSeconds)
			setHours(String(hm.hours || ''))
			setMinutes(String(hm.minutes || ''))
		}

		if (!params.sessionId) {
			const active = await getActiveSession(executor)
			if (active && active.libraryEntryId === entryId) {
				setSessionId(active.id)
			}
		}
	}, [entryId, executor, params.sessionId])

	useFocusEffect(
		useCallback(() => {
			void load()
		}, [load]),
	)

	useEffect(() => {
		const unsubscribe = navigation.addListener('beforeRemove', (event: {
			preventDefault: () => void
			data: { action: unknown }
		}) => {
			if (!dirty || saving) {
				return
			}
			event.preventDefault()
			Alert.alert(diaryCopy.dirtyTitle, undefined, [
				{
					text: diaryCopy.dirtyDiscard,
					style: 'destructive',
					onPress: () => navigation.dispatch(event.data.action as never),
				},
				{ text: diaryCopy.dirtyKeep, style: 'cancel' },
			])
		})
		return unsubscribe
	}, [navigation, dirty, saving])

	const locationFields = useMemo(() => {
		if (!item) {
			return null
		}
		if (item.entry.progressMode === 'PAGES') {
			return (
				<TextField
					label={diaryCopy.pageLabel}
					value={page}
					onChangeText={(v) => {
						setDirty(true)
						setPage(v)
					}}
					keyboardType="number-pad"
					placeholder="Необязательно"
				/>
			)
		}
		if (item.entry.progressMode === 'PERCENT') {
			return (
				<TextField
					label={diaryCopy.percentLabel}
					value={percent}
					onChangeText={(v) => {
						setDirty(true)
						setPercent(v)
					}}
					keyboardType="decimal-pad"
					placeholder="Необязательно"
				/>
			)
		}
		return (
			<View style={styles.row}>
				<View style={styles.flex}>
					<TextField
						label={diaryCopy.hoursLabel}
						value={hours}
						onChangeText={(v) => {
							setDirty(true)
							setHours(v)
						}}
						keyboardType="number-pad"
					/>
				</View>
				<View style={styles.flex}>
					<TextField
						label={diaryCopy.minutesLabel}
						value={minutes}
						onChangeText={(v) => {
							setDirty(true)
							setMinutes(v)
						}}
						keyboardType="number-pad"
					/>
				</View>
			</View>
		)
	}, [item, page, percent, hours, minutes])

	const handleSave = async () => {
		if (!entryId || !item) {
			return
		}
		setError(null)
		setSaving(true)
		try {
			let pageValue: number | null = null
			let percentValue: number | null = null
			let audioValue: number | null = null

			if (item.entry.progressMode === 'PAGES') {
				if (page.trim()) {
					pageValue = Number.parseInt(page, 10)
				}
			} else if (item.entry.progressMode === 'PERCENT') {
				if (percent.trim()) {
					percentValue = Number.parseFloat(percent)
				}
			} else if (hours.trim() || minutes.trim()) {
				audioValue = hoursMinutesToSeconds(
					Number.parseInt(hours || '0', 10),
					Number.parseInt(minutes || '0', 10),
				)
			}

			await createNote(executor, {
				libraryEntryId: entryId,
				type,
				text,
				readingSessionId: sessionId,
				page: pageValue,
				percent: percentValue,
				audioPositionSeconds: audioValue,
			})
			setDirty(false)
			if (params.returnTo === 'session') {
				router.replace('/sessions/active')
			} else {
				router.back()
			}
		} catch (err) {
			const message =
				err instanceof Error ? err.message : 'Не удалось сохранить'
			setError(message.replace(/^INVALID_NOTE:/, ''))
		} finally {
			setSaving(false)
		}
	}

	if (!entryId) {
		return (
			<>
				<Stack.Screen options={{ title: diaryCopy.newNote, headerShown: true }} />
				<Screen>
					<Text style={styles.error}>Книга не указана</Text>
				</Screen>
			</>
		)
	}

	return (
		<>
			<Stack.Screen options={{ title: diaryCopy.newNote, headerShown: true }} />
			<Screen scroll keyboardAvoiding contentStyle={styles.content}>
				{item ? (
					<Text style={styles.book} numberOfLines={2}>
						{item.book.title}
					</Text>
				) : null}

				<NoteTypeChips
					value={type}
					onChange={(next) => {
						setDirty(true)
						setType(next)
					}}
				/>

				<TextInput
					accessibilityLabel={notePlaceholder(type)}
					placeholder={notePlaceholder(type)}
					placeholderTextColor={colors.muted}
					value={text}
					onChangeText={(v) => {
						setDirty(true)
						setText(v)
					}}
					multiline
					textAlignVertical="top"
					style={[styles.input, error ? styles.inputError : null]}
				/>
				{error ? <Text style={styles.error}>{error}</Text> : null}

				<Text style={styles.section}>{diaryCopy.locationSection}</Text>
				{locationFields}

				{sessionId ? (
					<Text style={styles.sessionHint}>{diaryCopy.linkedSession}</Text>
				) : null}

				{/* Reserved slot for future OCR: «Сканировать текст» */}
				<View style={styles.ocrSlot} />

				<PrimaryButton
					label={appCopy.save}
					onPress={() => void handleSave()}
					loading={saving}
				/>
				<SecondaryButton label={appCopy.cancel} onPress={() => router.back()} />
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
	input: {
		minHeight: 160,
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
	section: {
		...typography.caption,
		color: colors.muted,
		textTransform: 'uppercase',
	},
	sessionHint: {
		...typography.bodySmall,
		color: colors.primaryDark,
	},
	row: {
		flexDirection: 'row',
		gap: spacing.sm,
	},
	flex: {
		flex: 1,
	},
	ocrSlot: {
		height: 0,
	},
})
