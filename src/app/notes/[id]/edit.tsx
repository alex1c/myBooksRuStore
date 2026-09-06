import { router, Stack, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native'

import { NoteTypeChips } from '@/components/notes/NoteTypeChips'
import {
	LoadingState,
	PrimaryButton,
	Screen,
	SecondaryButton,
	TextField,
} from '@/components/ui'
import { appCopy, diaryCopy } from '@/constants/copy'
import type { NoteType } from '@/constants/domain'
import { colors, radii, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import {
	getNoteWithBook,
	notePlaceholder,
	updateNote,
	type NoteWithBook,
} from '@/domain/diaryService'
import {
	hoursMinutesToSeconds,
	secondsToHoursMinutes,
} from '@/utils/progress'

/**
 * Edit note — type, text, location. Book association stays fixed.
 */
export default function EditNoteScreen () {
	const { id } = useLocalSearchParams<{ id: string }>()
	const { executor } = useDatabase()
	const navigation = useNavigation()
	const [bundle, setBundle] = useState<NoteWithBook | null>(null)
	const [type, setType] = useState<NoteType>('NOTE')
	const [text, setText] = useState('')
	const [page, setPage] = useState('')
	const [percent, setPercent] = useState('')
	const [hours, setHours] = useState('')
	const [minutes, setMinutes] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)
	const [dirty, setDirty] = useState(false)
	const [loading, setLoading] = useState(true)

	const load = useCallback(async () => {
		if (!id) {
			return
		}
		setLoading(true)
		try {
			const next = await getNoteWithBook(executor, id)
			setBundle(next)
			if (!next) {
				return
			}
			setType(next.note.type)
			setText(next.note.text)
			setPage(
				next.note.page != null ? String(next.note.page) : '',
			)
			setPercent(
				next.note.percent != null
					? String(Math.round(next.note.percent))
					: '',
			)
			const hm = secondsToHoursMinutes(next.note.audioPositionSeconds)
			setHours(String(hm.hours || ''))
			setMinutes(String(hm.minutes || ''))
			setDirty(false)
		} finally {
			setLoading(false)
		}
	}, [executor, id])

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

	const handleSave = async () => {
		if (!bundle) {
			return
		}
		setError(null)
		setSaving(true)
		try {
			const mode = bundle.item.entry.progressMode
			let pageValue: number | null = null
			let percentValue: number | null = null
			let audioValue: number | null = null

			if (mode === 'PAGES') {
				pageValue = page.trim() ? Number.parseInt(page, 10) : null
			} else if (mode === 'PERCENT') {
				percentValue = percent.trim()
					? Number.parseFloat(percent)
					: null
			} else {
				audioValue =
					hours.trim() || minutes.trim()
						? hoursMinutesToSeconds(
							Number.parseInt(hours || '0', 10),
							Number.parseInt(minutes || '0', 10),
						)
						: null
			}

			await updateNote(executor, bundle.note.id, {
				type,
				text,
				page: pageValue,
				percent: percentValue,
				audioPositionSeconds: audioValue,
			})
			setDirty(false)
			router.back()
		} catch (err) {
			const message =
				err instanceof Error ? err.message : 'Не удалось сохранить'
			setError(message.replace(/^INVALID_NOTE:/, ''))
		} finally {
			setSaving(false)
		}
	}

	if (loading && !bundle) {
		return <LoadingState />
	}

	if (!bundle) {
		return (
			<>
				<Stack.Screen options={{ title: diaryCopy.editNote, headerShown: true }} />
				<Screen>
					<Text style={styles.error}>Запись не найдена</Text>
				</Screen>
			</>
		)
	}

	const mode = bundle.item.entry.progressMode

	return (
		<>
			<Stack.Screen options={{ title: diaryCopy.editNote, headerShown: true }} />
			<Screen scroll keyboardAvoiding contentStyle={styles.content}>
				<Text style={styles.book}>{bundle.item.book.title}</Text>
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
				{mode === 'PAGES' ? (
					<TextField
						label={diaryCopy.pageLabel}
						value={page}
						onChangeText={(v) => {
							setDirty(true)
							setPage(v)
						}}
						keyboardType="number-pad"
					/>
				) : null}
				{mode === 'PERCENT' ? (
					<TextField
						label={diaryCopy.percentLabel}
						value={percent}
						onChangeText={(v) => {
							setDirty(true)
							setPercent(v)
						}}
						keyboardType="decimal-pad"
					/>
				) : null}
				{mode === 'TIME' ? (
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
				) : null}

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
	row: {
		flexDirection: 'row',
		gap: spacing.sm,
	},
	flex: {
		flex: 1,
	},
})
