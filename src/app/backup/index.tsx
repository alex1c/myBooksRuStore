/**
 * Backup & restore screen (Phase 9).
 */

import * as DocumentPicker from 'expo-document-picker'
import * as Sharing from 'expo-sharing'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert, StyleSheet, Text } from 'react-native'

import {
	Card,
	LoadingState,
	PrimaryButton,
	Screen,
	SecondaryButton,
	SectionHeader,
} from '@/components/ui'
import { backupCopy } from '@/constants/copy'
import { colors, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import {
	createBackupZipBytes,
	getBackupEntityCounts,
	restoreFromZipBytes,
} from '@/domain/backup/backupService'
import {
	createNativeCoverReader,
	createNativeCoverWriter,
	readFileAsBytes,
	writeTempBinaryFile,
} from '@/domain/backup/fileAdapters'
import { BackupValidationError } from '@/domain/backup/types'
import { formatBooksCount, formatIntegerRu } from '@/utils/format'

export default function BackupScreen () {
	const { executor } = useDatabase()
	const [counts, setCounts] = useState({ books: 0, sessions: 0, notes: 0 })
	const [busy, setBusy] = useState<'backup' | 'restore' | null>(null)

	const refreshCounts = useCallback(async () => {
		setCounts(await getBackupEntityCounts(executor))
	}, [executor])

	useFocusEffect(
		useCallback(() => {
			void refreshCounts()
		}, [refreshCounts]),
	)

	const handleCreate = async () => {
		if (busy) {
			return
		}
		setBusy('backup')
		try {
			const { bytes, fileName, archive } = await createBackupZipBytes(
				executor,
				createNativeCoverReader(),
			)
			const uri = await writeTempBinaryFile(fileName, bytes)
			Alert.alert(
				backupCopy.createdTitle,
				backupCopy.createdBody(
					archive.manifest.counts.books,
					archive.manifest.counts.readingSessions,
					archive.manifest.counts.readingNotes,
				),
				[
					{ text: backupCopy.done, style: 'cancel' },
					{
						text: backupCopy.share,
						onPress: () => {
							void Sharing.shareAsync(uri, {
								mimeType: 'application/zip',
								dialogTitle: backupCopy.share,
							})
						},
					},
				],
			)
			await refreshCounts()
		} catch {
			Alert.alert(backupCopy.errorTitle, backupCopy.backupFailed)
		} finally {
			setBusy(null)
		}
	}

	const runRestore = async (uri: string) => {
		setBusy('restore')
		try {
			const bytes = await readFileAsBytes(uri)
			await restoreFromZipBytes(
				executor,
				bytes,
				createNativeCoverWriter(),
			)
			Alert.alert(backupCopy.restoreSuccessTitle, backupCopy.restoreSuccessBody, [
				{
					text: backupCopy.done,
					onPress: () => router.replace('/(tabs)'),
				},
			])
		} catch (error) {
			const message =
				error instanceof BackupValidationError
					? error.message
					: backupCopy.restoreFailed
			Alert.alert(backupCopy.errorTitle, message)
		} finally {
			setBusy(null)
		}
	}

	const handleRestore = async () => {
		if (busy) {
			return
		}
		try {
			const picked = await DocumentPicker.getDocumentAsync({
				type: ['application/zip', 'application/x-zip-compressed', '*/*'],
				copyToCacheDirectory: true,
				multiple: false,
			})
			if (picked.canceled || !picked.assets?.[0]?.uri) {
				return
			}
			const uri = picked.assets[0].uri
			Alert.alert(backupCopy.restoreConfirmTitle, backupCopy.restoreConfirmBody, [
				{ text: backupCopy.cancel, style: 'cancel' },
				{
					text: backupCopy.makeSafetyBackup,
					onPress: () => {
						void (async () => {
							try {
								setBusy('backup')
								const { bytes, fileName } = await createBackupZipBytes(
									executor,
									createNativeCoverReader(),
								)
								await writeTempBinaryFile(`safety-${fileName}`, bytes)
							} catch {
								// Continue to restore even if safety backup fails —
								// transaction still protects current data until commit.
							} finally {
								setBusy(null)
							}
							Alert.alert(
								backupCopy.restoreConfirmTitle,
								backupCopy.restoreConfirmBody,
								[
									{ text: backupCopy.cancel, style: 'cancel' },
									{
										text: backupCopy.restore,
										style: 'destructive',
										onPress: () => {
											void runRestore(uri)
										},
									},
								],
							)
						})()
					},
				},
				{
					text: backupCopy.restore,
					style: 'destructive',
					onPress: () => {
						void runRestore(uri)
					},
				},
			])
		} catch {
			Alert.alert(backupCopy.errorTitle, backupCopy.restoreFailed)
		}
	}

	return (
		<Screen scroll contentStyle={styles.content}>
			<SectionHeader
				title={backupCopy.title}
				subtitle={backupCopy.subtitle}
			/>
			<Text style={styles.privacy}>{backupCopy.privacy}</Text>

			<Card style={styles.card}>
				<Text style={styles.counts}>
					{formatBooksCount(counts.books)}
				</Text>
				<Text style={styles.counts}>
					{formatIntegerRu(counts.sessions)} сессий
				</Text>
				<Text style={styles.counts}>
					{formatIntegerRu(counts.notes)} цитат и заметок
				</Text>
			</Card>

			{busy ? (
				<LoadingState
					message={
						busy === 'backup'
							? backupCopy.creating
							: backupCopy.restoring
					}
				/>
			) : (
				<>
					<PrimaryButton
						label={backupCopy.create}
						onPress={() => {
							void handleCreate()
						}}
					/>
					<SecondaryButton
						label={backupCopy.restoreFromFile}
						onPress={() => {
							void handleRestore()
						}}
					/>
				</>
			)}
		</Screen>
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
	card: {
		gap: spacing.xxs,
	},
	counts: {
		...typography.body,
		color: colors.text,
	},
})
