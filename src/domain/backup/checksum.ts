/**
 * SHA-256 helpers for backup integrity (Node crypto; expo-crypto when available).
 */

import { createHash } from 'crypto'

export async function sha256Hex (text: string): Promise<string> {
	try {
		const Crypto = await import('expo-crypto')
		const algo = Crypto.CryptoDigestAlgorithm.SHA256
		return await Crypto.digestStringAsync(algo, text)
	} catch {
		return createHash('sha256').update(text, 'utf8').digest('hex')
	}
}

/** Stable JSON stringify for checksum. */
export function canonicalDataJson (data: unknown): string {
	return JSON.stringify(data)
}
