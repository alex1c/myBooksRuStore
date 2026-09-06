import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native'

import {
	EmptyState,
	LoadingState,
	Screen,
	SecondaryButton,
} from '@/components/ui'
import { sessionCopy } from '@/constants/copy'
import { colors, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import { getLibraryBookByEntryId } from '@/domain/libraryService'
import {
	deleteCompletedSession,
	formatSessionHistoryLine,
	listBookSessions,
} from '@/domain/readingTrackerService'
import type { LibraryBookItem, ReadingSession } from '@/db/types'

/**
 * Full session history for one book (newest first). Delete keeps progress as-is.
 */
export default function BookHistoryScreen () {
	const { id } = useLocalSearchParams<{ id: string }>()
	const { executor } = useDatabase()
	const [item, setItem] = useState<LibraryBookItem | null>(null)
	const [sessions, setSessions] = useState<ReadingSession[]>([])
	const [loading, setLoading] = useState(true)

	const load = useCallback(async () => {
		if (!id) {
			return
		}
		setLoading(true)
		try {
			const [book, history] = await Promise.all([
				getLibraryBookByEntryId(executor, id),
				listBookSessions(executor, id),
			])
			setItem(book)
			setSessions(history.filter((s) => s.endedAt != null))
		} finally {
			setLoading(false)
		}
	}, [executor, id])

	useFocusEffect(
		useCallback(() => {
			void load()
		}, [load]),
	)

	const handleDelete = (session: ReadingSession) => {
		Alert.alert(sessionCopy.deleteSession, sessionCopy.deleteSessionHint, [
			{ text: 'Отмена', style: 'cancel' },
			{
				text: sessionCopy.deleteSession,
				style: 'destructive',
				onPress: () => {
					void (async () => {
						await deleteCompletedSession(executor, session.id)
						await load()
					})()
				},
			},
		])
	}

	if (loading && !item) {
		return <LoadingState />
	}

	return (
		<>
			<Stack.Screen
				options={{ title: sessionCopy.historyTitle, headerShown: true }}
			/>
			<Screen contentStyle={styles.content}>
				{item ? (
					<Text style={styles.book} numberOfLines={2}>
						{item.book.title}
					</Text>
				) : null}
				{sessions.length === 0 ? (
					<EmptyState
						icon="time-outline"
						title={sessionCopy.historyEmpty}
						description="Завершённые сессии появятся здесь."
					/>
				) : (
					<FlatList
						data={sessions}
						keyExtractor={(row) => row.id}
						renderItem={({ item: session }) => (
							<View style={styles.row}>
								<Text style={styles.line}>
									{formatSessionHistoryLine(
										session,
										item?.entry.progressMode ?? 'PAGES',
									)}
								</Text>
								<SecondaryButton
									label={sessionCopy.deleteSession}
									onPress={() => handleDelete(session)}
								/>
							</View>
						)}
						contentContainerStyle={styles.list}
					/>
				)}
			</Screen>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		flex: 1,
		gap: spacing.md,
		paddingTop: spacing.md,
	},
	book: {
		...typography.section,
		color: colors.text,
	},
	list: {
		gap: spacing.sm,
		paddingBottom: spacing.xl,
	},
	row: {
		gap: spacing.xs,
		paddingVertical: spacing.sm,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.border,
	},
	line: {
		...typography.body,
		color: colors.text,
	},
})
