/**
 * Backup service — create ZIP, restore from bytes/URI helpers.
 */

import { SqlExecutor } from '@/db/sqlExecutor'
import { toDateOnlyLocal } from '@/utils/dates'
import {
	collectBackupArchive,
	getBackupEntityCounts,
	type CoverReader,
} from './collectBackupData'
import {
	restoreBackupArchive,
	snapshotUserData,
	type CoverWriter,
} from './restoreBackup'
import type { BackupArchive } from './types'
import { unpackBackupZip, packBackupZip, isSafeCoverPath } from './zipArchive'

export {
	collectBackupArchive,
	getBackupEntityCounts,
	restoreBackupArchive,
	snapshotUserData,
	packBackupZip,
	unpackBackupZip,
	isSafeCoverPath,
}
export type { CoverReader, CoverWriter, BackupArchive }

/**
 * Build a ready-to-share backup ZIP filename.
 */
export function backupFileName (now: Date = new Date()): string {
	const day = toDateOnlyLocal(now)
	return `reading-diary-backup-${day}.zip`
}

/**
 * Full create path: collect → pack ZIP bytes.
 */
export async function createBackupZipBytes (
	db: SqlExecutor,
	coverReader?: CoverReader,
): Promise<{ bytes: Uint8Array; archive: BackupArchive; fileName: string }> {
	const archive = await collectBackupArchive(db, coverReader)
	const bytes = await packBackupZip(archive)
	const fileName = backupFileName()
	try {
		const { track } = await import('@/domain/analytics/analyticsService')
		const { AnalyticsEvents } = await import('@/domain/analytics/types')
		const hasCovers = Object.keys(archive.covers).length > 0
		track(AnalyticsEvents.backupCreated, { has_covers: hasCovers })
	} catch {
		// ignore
	}
	return { bytes, archive, fileName }
}

/**
 * Full restore path from ZIP bytes.
 */
export async function restoreFromZipBytes (
	db: SqlExecutor,
	bytes: Uint8Array,
	coverWriter?: CoverWriter,
): Promise<void> {
	try {
		const archive = await unpackBackupZip(bytes)
		await restoreBackupArchive(db, archive, coverWriter)
		try {
			const { track } = await import('@/domain/analytics/analyticsService')
			const { AnalyticsEvents } = await import('@/domain/analytics/types')
			track(AnalyticsEvents.restoreCompleted)
		} catch {
			// ignore
		}
	} catch (error) {
		try {
			const { track } = await import('@/domain/analytics/analyticsService')
			const { AnalyticsEvents } = await import('@/domain/analytics/types')
			const message = error instanceof Error ? error.message : ''
			let reason:
				| 'invalid_format'
				| 'checksum'
				| 'unsupported_version'
				| 'restore_error' = 'restore_error'
			if (/checksum|sha/i.test(message)) {
				reason = 'checksum'
			} else if (/version|unsupported/i.test(message)) {
				reason = 'unsupported_version'
			} else if (/format|zip|json|manifest/i.test(message)) {
				reason = 'invalid_format'
			}
			track(AnalyticsEvents.restoreFailed, { reason })
		} catch {
			// ignore
		}
		throw error
	}
}
