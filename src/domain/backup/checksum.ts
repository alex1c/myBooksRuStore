/**
 * SHA-256 helpers for backup integrity.
 * Prefer Web Crypto (Node Jest / modern runtimes), then expo-crypto on device.
 * Never statically import Node `crypto` — Metro cannot bundle it for RN.
 */

export async function sha256Hex (text: string): Promise<string> {
	const subtle = globalThis.crypto?.subtle
	if (subtle) {
		const encoded = new TextEncoder().encode(text)
		const digest = await subtle.digest('SHA-256', encoded)
		return Array.from(new Uint8Array(digest))
			.map((byte) => byte.toString(16).padStart(2, '0'))
			.join('')
	}

	const ExpoCrypto = await import('expo-crypto')
	const hex = await ExpoCrypto.digestStringAsync(
		ExpoCrypto.CryptoDigestAlgorithm.SHA256,
		text,
	)
	if (!hex || !/^[a-f0-9]{64}$/i.test(hex)) {
		throw new Error('SHA256_UNAVAILABLE')
	}
	return hex.toLowerCase()
}

/** Stable JSON stringify for checksum. */
export function canonicalDataJson (data: unknown): string {
	return JSON.stringify(data)
}
