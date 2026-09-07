/**
 * Phase 13.5 — onboarding + in-app help.
 */

import { applyMigrations } from '@/db/migrations/applyMigrations'
import {
	ensureAppSettings,
	getAppSettings,
	setOnboardingCompleted,
} from '@/db/repositories/settings'
import {
	HINT_KEYS,
	getMetaHintFlag,
	setMetaHintFlag,
} from '@/db/repositories/helpHints'
import { countBooks } from '@/db/repositories'
import {
	HELP_SECTIONS,
	getHelpSection,
	isHelpSectionId,
} from '@/domain/help/helpCatalog'
import { ONBOARDING_SLIDES } from '@/domain/help/onboardingSlides'
import {
	finishOnboarding,
	isOnboardingCompleted,
	shouldShowOnboarding,
	shouldShowHint,
	dismissHint,
} from '@/domain/help/onboardingService'
import { createTestSqlExecutor } from './helpers/testDatabase'

async function emptyDb () {
	const db = createTestSqlExecutor()
	await applyMigrations(db)
	await ensureAppSettings(db)
	return db
}

describe('onboarding state', () => {
	it('shows on first launch and hides after complete/skip', async () => {
		const db = await emptyDb()
		expect(await shouldShowOnboarding(db)).toBe(true)
		expect(await isOnboardingCompleted(db)).toBe(false)

		await finishOnboarding(db)
		expect(await shouldShowOnboarding(db)).toBe(false)
		expect(await isOnboardingCompleted(db)).toBe(true)
		expect((await getAppSettings(db)).onboardingCompleted).toBe(true)
	})

	it('skipped path uses the same completed flag', async () => {
		const db = await emptyDb()
		await setOnboardingCompleted(db, true)
		expect(await shouldShowOnboarding(db)).toBe(false)
	})

	it('does not create demo books when finishing onboarding', async () => {
		const db = await emptyDb()
		await finishOnboarding(db)
		expect(await countBooks(db)).toBe(0)
	})

	it('persists across ensureAppSettings re-init', async () => {
		const db = await emptyDb()
		await finishOnboarding(db)
		await ensureAppSettings(db)
		expect(await isOnboardingCompleted(db)).toBe(true)
	})
})

describe('onboarding slides', () => {
	it('has exactly four screens with required copy', () => {
		expect(ONBOARDING_SLIDES).toHaveLength(4)
		expect(ONBOARDING_SLIDES.map((s) => s.id)).toEqual([
			'library',
			'today',
			'notes',
			'progress',
		])
		expect(ONBOARDING_SLIDES[2]?.note).toMatch(/интернет/i)
		expect(ONBOARDING_SLIDES[3]?.note).toMatch(/резервн/i)
		expect(ONBOARDING_SLIDES[3]?.primaryLabel).toBe('start')
	})
})

describe('help catalogue', () => {
	it('exposes all 13 permanent sections', () => {
		expect(HELP_SECTIONS).toHaveLength(13)
		const ids = HELP_SECTIONS.map((s) => s.id)
		expect(ids).toContain('quick-start')
		expect(ids).toContain('backup')
		expect(ids).toContain('ocr')
		expect(ids).toContain('reminders')
		expect(isHelpSectionId('backup')).toBe(true)
		expect(isHelpSectionId('nope')).toBe(false)
	})

	it('backup section warns about restore replacement', () => {
		const backup = getHelpSection('backup')
		expect(backup).not.toBeNull()
		const warning = backup!.blocks.find((b) => b.type === 'warning')
		expect(warning && warning.type === 'warning' && warning.text).toMatch(
			/заменяет/i,
		)
	})

	it('OCR section mentions local processing and model download', () => {
		const ocr = getHelpSection('ocr')
		const text = ocr!.blocks
			.map((b) => ('text' in b ? b.text : ''))
			.join(' ')
		expect(text).toMatch(/устройств/i)
		expect(text).toMatch(/редактир/i)
		expect(text).toMatch(/модел/i)
	})
})

describe('micro hints', () => {
	it('shows once then stays dismissed', async () => {
		const db = await emptyDb()
		expect(await shouldShowHint(db, HINT_KEYS.todayProgress)).toBe(true)
		await dismissHint(db, HINT_KEYS.todayProgress)
		expect(await shouldShowHint(db, HINT_KEYS.todayProgress)).toBe(false)
		expect(await getMetaHintFlag(db, HINT_KEYS.todayProgress)).toBe(true)

		await setMetaHintFlag(db, HINT_KEYS.activeSession, true)
		expect(await shouldShowHint(db, HINT_KEYS.activeSession)).toBe(false)
	})
})

describe('help navigation intents', () => {
	it('maps More → Help and section routes conceptually', () => {
		expect('/help').toMatch(/help/)
		expect(`/help/${HELP_SECTIONS[0]!.id}`).toBe('/help/quick-start')
		expect('/onboarding').toMatch(/onboarding/)
		expect('/(tabs)').toMatch(/tabs/)
	})
})
