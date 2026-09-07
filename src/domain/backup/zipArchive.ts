/**
 * ZIP pack/unpack for backup archives (JSZip — works in RN + Jest).
 */

import JSZip from 'jszip'

import {
	BACKUP_DATA_NAME,
	BACKUP_MANIFEST_NAME,
	BACKUP_COVERS_DIR,
	MAX_BACKUP_COVER_BYTES,
	MAX_BACKUP_COVER_FILES,
	MAX_BACKUP_DATA_BYTES,
	MAX_BACKUP_MANIFEST_BYTES,
	MAX_BACKUP_TOTAL_COVER_BYTES,
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
		const manifestText = await readTextWithLimit(
			manifestFile,
			MAX_BACKUP_MANIFEST_BYTES,
		)
		const dataText = await readTextWithLimit(dataFile, MAX_BACKUP_DATA_BYTES)
		manifest = JSON.parse(manifestText) as BackupManifest
		data = JSON.parse(dataText) as BackupData
	} catch {
		throw new BackupValidationError(
			'MALFORMED_DATA',
			'Повреждённый JSON в резервной копии.',
		)
	}

	const covers: Record<string, Uint8Array> = {}
	const allNames = Object.keys(zip.files)
	for (const name of allNames) {
		if (
			name.startsWith(`${BACKUP_COVERS_DIR}/`) &&
			!zip.files[name]!.dir &&
			!isSafeCoverPath(name)
		) {
			throw new BackupValidationError(
				'INVALID_FORMAT',
				'Небезопасный путь файла обложки в резервной копии.',
			)
		}
	}
	const coverFiles = allNames.filter(
		(name) =>
			name.startsWith(`${BACKUP_COVERS_DIR}/`) &&
			!zip.files[name]!.dir &&
			name.toLowerCase().endsWith('.jpg'),
	)
	if (coverFiles.length > MAX_BACKUP_COVER_FILES) {
		throw new BackupValidationError(
			'INVALID_FORMAT',
			'В резервной копии слишком много файлов обложек.',
		)
	}
	let totalCoverBytes = 0
	for (const name of coverFiles) {
		const file = zip.file(name)
		if (!file) {
			continue
		}
		const coverBytes = await file.async('uint8array')
		if (coverBytes.byteLength > MAX_BACKUP_COVER_BYTES) {
			throw new BackupValidationError(
				'INVALID_FORMAT',
				'Файл обложки в резервной копии слишком большой.',
			)
		}
		totalCoverBytes += coverBytes.byteLength
		if (totalCoverBytes > MAX_BACKUP_TOTAL_COVER_BYTES) {
			throw new BackupValidationError(
				'INVALID_FORMAT',
				'Обложки в резервной копии занимают слишком много места.',
			)
		}
		covers[name] = coverBytes
	}

	return { manifest, data, covers }
}

async function readTextWithLimit (file: JSZip.JSZipObject, maxBytes: number): Promise<string> {
	const bytes = await file.async('uint8array')
	if (bytes.byteLength > maxBytes) {
		throw new BackupValidationError(
			'INVALID_FORMAT',
			'Файл данных в резервной копии слишком большой.',
		)
	}
	return new TextDecoder().decode(bytes)
}

export function isSafeCoverPath (name: string): boolean {
	if (name.includes('\\') || !name.toLowerCase().endsWith('.jpg')) {
		return false
	}
	const parts = name.split('/')
	return parts.length === 2 && parts[0] === BACKUP_COVERS_DIR && !!parts[1]
}
