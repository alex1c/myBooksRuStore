import { router, Stack, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'

import { SessionTimer } from '@/components/reading/SessionTimer'
import { MicroHintBanner } from '@/components/help/MicroHintBanner'
import {
	LoadingState,
	PrimaryButton,
	Screen,
	SecondaryButton,
} from '@/components/ui'
import { appCopy, diaryCopy, helpCopy, sessionCopy } from '@/constants/copy'
import { colors, radii, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import {
	dismissHint,
	HINT_KEYS,
	shouldShowHint,
} from '@/domain/help/onboardingService'
import {
	cancelReadingSession,
	getActiveSessionBundle,
	type ActiveSessionBundle,
} from '@/domain/readingTrackerService'
import { formatDuration } from '@/utils/progress'
import {
	elapsedSecondsFromStart,
	LONG_SESSION_WARNING_SECONDS,
} from '@/utils/sessionTimer'

/**
 * Active reading session screen — timer from timestamps, finish / cancel.
 */
export default function ActiveSessionScreen () {
	const { executor } = useDatabase()
	const [bundle, setBundle] = useState<ActiveSessionBundle | null>(null)
	const [loading, setLoading] = useState(true)
	const [showSessionHint, setShowSessionHint] = useState(false)

	const load = useCallback(async () => {
		setLoading(true)
		try {
			const [next, hint] = await Promise.all([
				getActiveSessionBundle(executor),
				shouldShowHint(executor, HINT_KEYS.activeSession),
			])
			setBundle(next)
			setShowSessionHint(Boolean(next) && hint)
		} finally {
			setLoading(false)
		}
	}, [executor])

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
				<Stack.Screen options={{ title: sessionCopy.title, headerShown: true }} />
				<Screen>
					<Text style={styles.missing}>Нет активной сессии</Text>
					<PrimaryButton
						label="На экран Сегодня"
						onPress={() => router.replace('/(tabs)')}
					/>
				</Screen>
			</>
		)
	}

	const { session, item } = bundle
	const entry = item.entry
	const startedLabel = (() => {
		if (entry.progressMode === 'PAGES' && session.startPage != null) {
			return sessionCopy.startedFromPages(session.startPage)
		}
		if (entry.progressMode === 'PERCENT' && session.startPercent != null) {
			return sessionCopy.startedFromPercent(session.startPercent)
		}
		if (entry.progressMode === 'TIME' && session.startAudioSeconds != null) {
			return sessionCopy.startedFromTime(
				formatDuration(session.startAudioSeconds),
			)
		}
		return null
	})()

	const isLong =
		elapsedSecondsFromStart(session.startedAt) >= LONG_SESSION_WARNING_SECONDS

	const handleCancel = () => {
		Alert.alert(
			sessionCopy.cancelConfirmTitle,
			sessionCopy.cancelConfirmMessage,
			[
				{ text: 'Нет', style: 'cancel' },
				{
					text: sessionCopy.cancelConfirmAction,
					style: 'destructive',
					onPress: () => {
						void (async () => {
							await cancelReadingSession(executor, session.id)
							router.replace('/(tabs)')
						})()
					},
				},
			],
		)
	}

	return (
		<>
			<Stack.Screen options={{ title: sessionCopy.title, headerShown: true }} />
			<Screen contentStyle={styles.content}>
				<Text style={styles.bookTitle}>{item.book.title}</Text>
				<Text style={styles.subtitle}>{sessionCopy.title}</Text>

				{showSessionHint ? (
					<MicroHintBanner
						message={helpCopy.hintActiveSession}
						dismissLabel={helpCopy.hintDismiss}
						onDismiss={() => {
							setShowSessionHint(false)
							void dismissHint(executor, HINT_KEYS.activeSession)
						}}
					/>
				) : null}

				<View style={styles.timerCard}>
					<SessionTimer startedAt={session.startedAt} />
				</View>

				{startedLabel ? (
					<Text style={styles.started}>{startedLabel}</Text>
				) : null}

				{isLong ? (
					<Text style={styles.warning}>{sessionCopy.longSessionWarning}</Text>
				) : null}

				<PrimaryButton
					label={sessionCopy.finish}
					onPress={() =>
						router.push({
							pathname: '/sessions/finish',
							params: { sessionId: session.id },
						})
					}
				/>
				<SecondaryButton
					label={diaryCopy.addNoteDuringSession}
					onPress={() => {
						Alert.alert(diaryCopy.addNote, undefined, [
							{
								text: diaryCopy.typeQuote,
								onPress: () =>
									router.push({
										pathname: '/notes/new',
										params: {
											entryId: item.entry.id,
											type: 'QUOTE',
											sessionId: session.id,
											returnTo: 'session',
										},
									}),
							},
							{
								text: diaryCopy.typeThought,
								onPress: () =>
									router.push({
										pathname: '/notes/new',
										params: {
											entryId: item.entry.id,
											type: 'THOUGHT',
											sessionId: session.id,
											returnTo: 'session',
										},
									}),
							},
							{
								text: diaryCopy.typeNote,
								onPress: () =>
									router.push({
										pathname: '/notes/new',
										params: {
											entryId: item.entry.id,
											type: 'NOTE',
											sessionId: session.id,
											returnTo: 'session',
										},
									}),
							},
							{ text: appCopy.cancel, style: 'cancel' },
						])
					}}
				/>
				<SecondaryButton
					label={sessionCopy.cancelSession}
					onPress={handleCancel}
				/>
			</Screen>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		gap: spacing.md,
		paddingTop: spacing.lg,
	},
	bookTitle: {
		...typography.title,
		fontSize: 24,
		textAlign: 'center',
	},
	subtitle: {
		...typography.subtitle,
		textAlign: 'center',
		marginTop: -spacing.sm,
	},
	timerCard: {
		backgroundColor: colors.surface,
		borderRadius: radii.xl,
		paddingVertical: spacing.xl,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
		marginVertical: spacing.md,
	},
	started: {
		...typography.body,
		textAlign: 'center',
		color: colors.textSecondary,
	},
	warning: {
		...typography.bodySmall,
		color: colors.warning,
		textAlign: 'center',
		backgroundColor: '#F8F1E0',
		padding: spacing.sm,
		borderRadius: radii.md,
	},
	missing: {
		...typography.body,
		marginBottom: spacing.md,
	},
})
