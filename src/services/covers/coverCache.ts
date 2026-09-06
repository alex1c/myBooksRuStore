/**
 * Best-effort cover download into app document storage.
 * Never blocks book creation — failure leaves remote URL usable.
 */

import * as FileSystem from 'expo-file-system/legacy'

/**
 * Download a remote cover into a local file. Returns local URI or null on failure.
 */
export async function cacheCoverImage (
	remoteUrl: string,
	bookId: string,
): Promise<string | null> {
	try {
		const base = FileSystem.documentDirectory
		if (!base) {
			return null
		}
		const dir = `${base}covers`
		const info = await FileSystem.getInfoAsync(dir)
		if (!info.exists) {
			await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
		}
		const target = `${dir}/${bookId}.jpg`
		const result = await FileSystem.downloadAsync(remoteUrl, target)
		if (result.status !== 200) {
			return null
		}
		return result.uri
	} catch {
		return null
	}
}
