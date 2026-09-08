/**
 * Regression: checksum must not depend on Node `crypto` (Metro/RN incompatible).
 */

import * as fs from 'fs'
import * as path from 'path'

import { canonicalDataJson, sha256Hex } from '@/domain/backup/checksum'

describe('backup checksum metro safety', () => {
	it('produces a stable 64-char hex digest without Node crypto import', async () => {
		const hex = await sha256Hex('reading-diary')
		expect(hex).toMatch(/^[a-f0-9]{64}$/)
		expect(await sha256Hex('reading-diary')).toBe(hex)
		expect(canonicalDataJson({ a: 1 })).toBe('{"a":1}')
	})

	it('does not statically import Node crypto in checksum.ts', () => {
		const file = fs.readFileSync(
			path.join(__dirname, '../src/domain/backup/checksum.ts'),
			'utf8',
		)
		expect(file).not.toMatch(/from ['"]crypto['"]/)
		expect(file).not.toMatch(/require\(['"]crypto['"]\)/)
	})
})
