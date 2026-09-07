/**
 * ZIP pack/unpack for backup archives (JSZip — works in RN + Jest).
 */

import JSZip from 'jszip'

import {
	BACKUP_DATA_NAME,
	BACKUP_MANIFEST_NAME,
} from './constants'
import type { BackupArchive, BackupData, BackupManifest } from './types'
import { BackupValidationError } from './types'

export async function packBackupZip (archive: BackupArchive): Promise<Uint8Array> {
	const zip = new JSZip()
	zip.file(BACKUP_MANIFEST_NAME, JSON.stringify(archive.manifest, null, 2))
	zip.file(BACKUP_DATA_NAME, JSON.stringify(archive.data))
	for (const [path, bytes] of Object.entries(archive.covers)) {
		zip.file(path, bytes)
	}
	const out = await zip.generateAsync({
		type: 'uint8array',
		compression: 'DEFLATE',
		compressionOptions: { level: 6 },
	})
	return out
}

export async function unpackBackupZip (bytes: Uint8Array): Promise<BackupArchive> {
	let zip: JSZip
	try {
		zip = await JSZip.loadAsync(bytes)
	} catch {
		throw new BackupValidationError(
			'INVALID_FORMAT',
			'Не удалось прочитать ZIP-архив.',
		)
	}

	const manifestFile = zip.file(BACKUP_MANIFEST_NAME)
	const dataFile = zip.file(BACKUP_DATA_NAME)
	if (!manifestFile || !dataFile) {
		throw new BackupValidationError(
			'INVALID_FORMAT',
			'В архиве нет manifest.json или data.json.',
		)
	}

	let manifest: BackupManifest
	let data: BackupData
	try {
		manifest = JSON.parse(await manifestFile.async('string')) as BackupManifest
		data = JSON.parse(await dataFile.async('string')) as BackupData
	} catch {
		throw new BackupValidationError(
			'MALFORMED_DATA',
			'Повреждённый JSON в резервной копии.',
		)
	}

	const covers: Record<string, Uint8Array> = {}
	const coverFiles = Object.keys(zip.files).filter(
		(name) =>
			name.startsWith('covers/') &&
			!zip.files[name]!.dir &&
			name.toLowerCase().endsWith('.jpg'),
	)
	for (const name of coverFiles) {
		const file = zip.file(name)
		if (!file) {
			continue
		}
		covers[name] = await file.async('uint8array')
	}

	return { manifest, data, covers }
}
