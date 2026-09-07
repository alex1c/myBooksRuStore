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
	return { bytes, archive, fileName: backupFileName() }
}

/**
 * Full restore path from ZIP bytes.
 */
export async function restoreFromZipBytes (
	db: SqlExecutor,
	bytes: Uint8Array,
	coverWriter?: CoverWriter,
): Promise<void> {
	const archive = await unpackBackupZip(bytes)
	await restoreBackupArchive(db, archive, coverWriter)
}
