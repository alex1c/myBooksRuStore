import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'

import {
	LoadingState,
	PrimaryButton,
	Screen,
	SecondaryButton,
	TextField,
} from '@/components/ui'
import { sessionCopy } from '@/constants/copy'
import { colors, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import {
	finishReadingSession,
	getActiveSessionBundle,
	isCompletionReached,
	markBookFinished,
} from '@/domain/readingTrackerService'
import { getReadingSessionById } from '@/db/repositories/readingSessions'
import { getLibraryBookByEntryId } from '@/domain/libraryService'
import type { LibraryBookItem, ReadingSession } from '@/db/types'
import {
	formatDuration,
	hoursMinutesToSeconds,
	secondsToHoursMinutes,
} from '@/utils/progress'
import {
	durationSecondsBetween,
	formatSessionDurationLabel,
} from '@/utils/sessionTimer'
import { nowIso } from '@/utils/dates'

/**
 * Compact finish-session form: duration + end progress + save / discard.
 */
export default function FinishSessionScreen () {
	const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
	const { executor } = useDatabase()
	const [session, setSession] = useState<ReadingSession | null>(null)
	const [item, setItem] = useState<LibraryBookItem | null>(null)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [page, setPage] = useState('')
	const [percent, setPercent] = useState('')
	const [hours, setHours] = useState('')
	const [minutes, setMinutes] = useState('')
	const [error, setError] = useState<string | null>(null)

	const load = useCallback(async () => {
		if (!sessionId) {
			return
		}
		setLoading(true)
		try {
			let next = await getReadingSessionById(executor, sessionId)
			if (!next || next.endedAt != null) {
				const active = await getActiveSessionBundle(executor)
				next = active?.session ?? null
			}
			if (!next) {
				setSession(null)
				setItem(null)
				return
			}
			const book = await getLibraryBookByEntryId(executor, next.libraryEntryId)
			setSession(next)
			setItem(book)
			if (book) {
				setPage(String(book.entry.currentPage ?? ''))
				setPercent(
					String(
						book.entry.currentPercent != null
							? Math.round(book.entry.currentPercent)
							: '',
					),
				)
				const hm = secondsToHoursMinutes(book.entry.audioPositionSeconds)
				setHours(String(hm.hours || ''))
				setMinutes(String(hm.minutes || ''))
			}
		} finally {
			setLoading(false)
		}
	}, [executor, sessionId])

	useFocusEffect(
		useCallback(() => {
			void load()
		}, [load]),
	)

	if (loading) {
		return <LoadingState />
	}

	if (!session || !item) {
		return (
			<>
				<Stack.Screen
					options={{ title: sessionCopy.finishTitle, headerShown: true }}
				/>
				<Screen>
					<Text style={styles.body}>Сессия не найдена</Text>
					<PrimaryButton
						label="Назад"
						onPress={() => router.replace('/(tabs)')}
					/>
				</Screen>
			</>
		)
	}

	const durationSec = durationSecondsBetween(session.startedAt, nowIso())
	const durationLabel = formatSessionDurationLabel(durationSec)
	const entry = item.entry

	const wasLabel = (() => {
		if (entry.progressMode === 'PAGES') {
			return session.startPage != null
				? `стр. ${session.startPage}`
				: '—'
		}
		if (entry.progressMode === 'PERCENT') {
			return session.startPercent != null
				? `${Math.round(session.startPercent)}%`
				: '—'
		}
		return session.startAudioSeconds != null
			? formatDuration(session.startAudioSeconds)
			: '—'
	})()

	const deltaHint = (() => {
		if (entry.progressMode === 'PAGES') {
			const start = session.startPage ?? 0
			const end = Number.parseInt(page || '0', 10)
			if (Number.isNaN(end)) {
				return null
			}
			const d = end - start
			return d === 0 ? '0 страниц' : d > 0 ? `+${d} страниц` : `${d} страниц`
		}
		if (entry.progressMode === 'PERCENT') {
			const start = session.startPercent ?? 0
			const end = Number.parseFloat(percent || '0')
			if (Number.isNaN(end)) {
				return null
			}
			const d = Math.round(end - start)
			return d === 0 ? '0%' : d > 0 ? `+${d}%` : `${d}%`
		}
		const start = session.startAudioSeconds ?? 0
		const end = hoursMinutesToSeconds(
			Number.parseInt(hours || '0', 10),
			Number.parseInt(minutes || '0', 10),
		)
		const d = end - start
		if (d === 0) {
			return '0 мин'
		}
		return d > 0
			? `+${formatDuration(d)}`
			: `-${formatDuration(Math.abs(d))}`
	})()

	const handleSave = async () => {
		setError(null)
		setSaving(true)
		try {
			const result = await finishReadingSession(executor, {
				sessionId: session.id,
				endPage:
					entry.progressMode === 'PAGES'
						? Number.parseInt(page, 10)
						: undefined,
				endPercent:
					entry.progressMode === 'PERCENT'
						? Number.parseFloat(percent)
						: undefined,
				endAudioSeconds:
					entry.progressMode === 'TIME'
						? hoursMinutesToSeconds(
							Number.parseInt(hours || '0', 10),
							Number.parseInt(minutes || '0', 10),
						)
						: undefined,
			})

			if (
				result.completionReached ||
				isCompletionReached(result.item.entry)
			) {
				Alert.alert(
					sessionCopy.completionTitle,
					sessionCopy.completionMessage,
					[
						{
							text: sessionCopy.completionLater,
							style: 'cancel',
							onPress: () => router.replace('/(tabs)'),
						},
						{
							text: sessionCopy.completionDone,
							onPress: () => {
								void (async () => {
									await markBookFinished(executor, result.item.entry.id, {
										applySuggestedProgress: true,
									})
									router.replace('/(tabs)')
								})()
							},
						},
					],
				)
				return
			}

			router.replace('/(tabs)')
		} catch (err) {
			const message =
				err instanceof Error ? err.message : 'Не удалось сохранить'
			setError(message.replace(/^INVALID_PROGRESS:/, ''))
		} finally {
			setSaving(false)
		}
	}

	const handleDiscard = () => {
		Alert.alert(
			sessionCopy.cancelConfirmTitle,
			sessionCopy.cancelConfirmMessage,
			[
				{ text: 'Нет', style: 'cancel' },
				{
					text: sessionCopy.discard,
					style: 'destructive',
					onPress: () => {
						void (async () => {
							await finishReadingSession(executor, {
								sessionId: session.id,
								discard: true,
							})
							router.replace('/(tabs)')
						})()
					},
				},
			],
		)
	}

	return (
		<>
			<Stack.Screen
				options={{ title: sessionCopy.finishTitle, headerShown: true }}
			/>
			<Screen scroll contentStyle={styles.content}>
				<Text style={styles.book}>{item.book.title}</Text>
				<Text style={styles.duration}>
					{sessionCopy.durationLabel(durationLabel)}
				</Text>

				<Text style={styles.label}>{sessionCopy.was}</Text>
				<Text style={styles.value}>{wasLabel}</Text>

				<Text style={styles.label}>{sessionCopy.now}</Text>
				{entry.progressMode === 'PAGES' ? (
					<TextField
						label={sessionCopy.pageLabel}
						value={page}
						onChangeText={setPage}
						keyboardType="number-pad"
						error={error ?? undefined}
					/>
				) : null}
				{entry.progressMode === 'PERCENT' ? (
					<TextField
						label={sessionCopy.percentLabel}
						value={percent}
						onChangeText={setPercent}
						keyboardType="decimal-pad"
						error={error ?? undefined}
					/>
				) : null}
				{entry.progressMode === 'TIME' ? (
					<View style={styles.row}>
						<View style={styles.flex}>
							<TextField
								label={sessionCopy.hoursLabel}
								value={hours}
								onChangeText={setHours}
								keyboardType="number-pad"
							/>
						</View>
						<View style={styles.flex}>
							<TextField
								label={sessionCopy.minutesLabel}
								value={minutes}
								onChangeText={setMinutes}
								keyboardType="number-pad"
								error={error ?? undefined}
							/>
						</View>
					</View>
				) : null}

				{deltaHint ? <Text style={styles.delta}>{deltaHint}</Text> : null}

				<PrimaryButton
					label={sessionCopy.save}
					onPress={() => void handleSave()}
					loading={saving}
				/>
				<SecondaryButton
					label={sessionCopy.discard}
					onPress={handleDiscard}
				/>
			</Screen>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		gap: spacing.md,
		paddingBottom: spacing.xl,
	},
	book: {
		...typography.section,
		color: colors.text,
	},
	duration: {
		...typography.title,
		fontSize: 22,
		color: colors.primaryDark,
	},
	label: {
		...typography.caption,
		color: colors.muted,
		textTransform: 'uppercase',
	},
	value: {
		...typography.body,
		marginTop: -spacing.sm,
	},
	delta: {
		...typography.bodySmall,
		color: colors.primaryDark,
		fontWeight: '600',
	},
	row: {
		flexDirection: 'row',
		gap: spacing.sm,
	},
	flex: {
		flex: 1,
	},
	body: {
		...typography.body,
		marginBottom: spacing.md,
	},
})
