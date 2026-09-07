/**
 * Native filesystem adapters for backup covers + temp ZIP files.
 */

import * as FileSystem from 'expo-file-system/legacy'

import type { CoverReader } from './collectBackupData'
import type { CoverWriter } from './restoreBackup'

function coversDir (): string | null {
	const base = FileSystem.documentDirectory
	if (!base) {
		return null
	}
	return `${base}covers`
}

export function createNativeCoverReader (): CoverReader {
	return {
		async readLocalCover (bookId, coverUri) {
			try {
				const dir = coversDir()
				const candidates = [
					coverUri,
					dir ? `${dir}/${bookId}.jpg` : null,
				].filter(Boolean) as string[]
				for (const uri of candidates) {
					const info = await FileSystem.getInfoAsync(uri)
					if (!info.exists || info.isDirectory) {
						continue
					}
					const base64 = await FileSystem.readAsStringAsync(uri, {
						encoding: FileSystem.EncodingType.Base64,
					})
					return base64ToBytes(base64)
				}
				return null
			} catch {
				return null
			}
		},
	}
}

export function createNativeCoverWriter (): CoverWriter {
	return {
		async clearCovers () {
			const dir = coversDir()
			if (!dir) {
				return
			}
			const info = await FileSystem.getInfoAsync(dir)
			if (info.exists) {
				await FileSystem.deleteAsync(dir, { idempotent: true })
			}
		},
		async writeCover (bookId, _relative, bytes) {
			const dir = coversDir()
			if (!dir) {
				return null
			}
			const info = await FileSystem.getInfoAsync(dir)
			if (!info.exists) {
				await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
			}
			const target = `${dir}/${bookId}.jpg`
			await FileSystem.writeAsStringAsync(target, bytesToBase64(bytes), {
				encoding: FileSystem.EncodingType.Base64,
			})
			return target
		},
	}
}

/** Write Uint8Array to cache and return file URI for sharing. */
export async function writeTempBinaryFile (
	fileName: string,
	bytes: Uint8Array,
): Promise<string> {
	const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory
	if (!base) {
		throw new Error('NO_FILESYSTEM')
	}
	const dir = `${base}exports`
	const info = await FileSystem.getInfoAsync(dir)
	if (!info.exists) {
		await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
	}
	const uri = `${dir}/${fileName}`
	await FileSystem.writeAsStringAsync(uri, bytesToBase64(bytes), {
		encoding: FileSystem.EncodingType.Base64,
	})
	return uri
}

export async function writeTempTextFile (
	fileName: string,
	text: string,
): Promise<string> {
	const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory
	if (!base) {
		throw new Error('NO_FILESYSTEM')
	}
	const dir = `${base}exports`
	const info = await FileSystem.getInfoAsync(dir)
	if (!info.exists) {
		await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
	}
	const uri = `${dir}/${fileName}`
	await FileSystem.writeAsStringAsync(uri, text, {
		encoding: FileSystem.EncodingType.UTF8,
	})
	return uri
}

export async function cleanupExportTempFiles (): Promise<void> {
	try {
		const base = FileSystem.cacheDirectory
		if (!base) {
			return
		}
		const dir = `${base}exports`
		const info = await FileSystem.getInfoAsync(dir)
		if (info.exists) {
			await FileSystem.deleteAsync(dir, { idempotent: true })
		}
	} catch {
		// Best-effort cleanup.
	}
}

function bytesToBase64 (bytes: Uint8Array): string {
	let binary = ''
	const chunk = 0x8000
	for (let i = 0; i < bytes.length; i += chunk) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
	}
	// btoa available in RN hermes / jest via buffer polyfill may differ
	if (typeof btoa === 'function') {
		return btoa(binary)
	}
	return Buffer.from(bytes).toString('base64')
}

function base64ToBytes (base64: string): Uint8Array {
	if (typeof atob === 'function') {
		const binary = atob(base64)
		const out = new Uint8Array(binary.length)
		for (let i = 0; i < binary.length; i += 1) {
			out[i] = binary.charCodeAt(i)
		}
		return out
	}
	return new Uint8Array(Buffer.from(base64, 'base64'))
}

export async function readFileAsBytes (uri: string): Promise<Uint8Array> {
	const base64 = await FileSystem.readAsStringAsync(uri, {
		encoding: FileSystem.EncodingType.Base64,
	})
	return base64ToBytes(base64)
}
