/**
 * Phase 14 — analytics privacy + ads policy / interstitial gates.
 */

import {
	ADS_INTERSTITIAL_MIN_ACTIONS,
	ADS_INTERSTITIAL_MIN_ELAPSED_MS,
	getProductionBannerId,
	getProductionInterstitialId,
} from '@/config/ads'
import { APPMETRICA_API_KEY } from '@/config/analytics'
import {
	createMemoryAnalyticsAdapter,
	initializeAnalytics,
	setAnalyticsAdapter,
	track,
	trackStrict,
} from '@/domain/analytics/analyticsService'
import {
	AnalyticsPrivacyError,
	FORBIDDEN_ANALYTICS_KEYS,
	findForbiddenAnalyticsKeys,
} from '@/domain/analytics/privacy'
import { AnalyticsEvents } from '@/domain/analytics/types'
import { AdContexts } from '@/domain/ads/adContexts'
import {
	createMemoryAdsAdapter,
	getAdsSessionState,
	initializeAds,
	resetAdsSession,
	setAdsAdapter,
	tryShowInterstitial,
	recordMeaningfulAdAction,
} from '@/domain/ads/adsService'
import { resolveBannerPlacement } from '@/domain/ads/bannerPolicy'
import {
	canShowInterstitial,
	createInterstitialSessionState,
	markInterstitialShown,
	recordMeaningfulAction,
} from '@/domain/ads/interstitialPolicy'
import { durationBucket, importSizeBucket } from '@/domain/analytics/mappers'

describe('analytics config', () => {
	it('keeps the production AppMetrica API key centralized', () => {
		expect(APPMETRICA_API_KEY).toBe('977b210e-00ab-4cc5-bbce-ed4357b18f38')
	})

	it('keeps production ad placement IDs centralized', () => {
		expect(getProductionBannerId('today_library')).toBe('R-M-20004307-1')
		expect(getProductionBannerId('diary_stats')).toBe('R-M-20004307-2')
		expect(getProductionBannerId('more')).toBe('R-M-20004307-3')
		expect(getProductionInterstitialId()).toBe('R-M-20004307-4')
	})
})

describe('analytics privacy', () => {
	const memory = createMemoryAnalyticsAdapter()

	beforeEach(() => {
		memory.reset()
		setAnalyticsAdapter(memory)
		initializeAnalytics()
	})

	afterEach(() => {
		setAnalyticsAdapter(null)
	})

	it('rejects forbidden private parameter keys', () => {
		expect(() =>
			trackStrict(AnalyticsEvents.bookAdded, {
				source: 'manual',
				title: 'Secret',
			} as never),
		).toThrow(AnalyticsPrivacyError)
	})

	it('lists forbidden keys for regression coverage', () => {
		for (const key of FORBIDDEN_ANALYTICS_KEYS) {
			expect(
				findForbiddenAnalyticsKeys({ [key]: 'x' } as never).length,
			).toBeGreaterThan(0)
		}
	})

	it('tracks book_added sources without title/author/isbn', () => {
		const sources = ['manual', 'search', 'isbn', 'import'] as const
		for (const source of sources) {
			track(AnalyticsEvents.bookAdded, {
				source,
				format: 'paper',
				initial_status: 'WANT_TO_READ',
			})
		}
		expect(memory.events).toHaveLength(4)
		for (const entry of memory.events) {
			expect(entry.event).toBe('book_added')
			expect(entry.params).not.toHaveProperty('title')
			expect(entry.params).not.toHaveProperty('author')
			expect(entry.params).not.toHaveProperty('isbn')
		}
	})

	it('tracks session start/finish/cancel without private data', () => {
		track(AnalyticsEvents.readingSessionStarted, { progress_mode: 'pages' })
		track(AnalyticsEvents.readingSessionFinished, {
			progress_mode: 'pages',
			duration_bucket: durationBucket(700),
		})
		track(AnalyticsEvents.readingSessionCancelled)
		expect(memory.events.map((e) => e.event)).toEqual([
			'reading_session_started',
			'reading_session_finished',
			'reading_session_cancelled',
		])
		expect(memory.events[1]?.params?.duration_bucket).toBe('5-15m')
	})

	it('tracks note type only', () => {
		track(AnalyticsEvents.readingNoteAdded, { type: 'quote' })
		expect(memory.events[0]?.params).toEqual({ type: 'quote' })
		expect(memory.events[0]?.params).not.toHaveProperty('text')
	})

	it('tracks OCR result category only', () => {
		track(AnalyticsEvents.ocrCompleted, { result: 'success' })
		expect(memory.events[0]?.params).toEqual({ result: 'success' })
		expect(memory.events[0]?.params).not.toHaveProperty('image')
		expect(memory.events[0]?.params).not.toHaveProperty('text')
	})

	it('tracks backup/import without filenames', () => {
		track(AnalyticsEvents.backupCreated, { has_covers: true })
		track(AnalyticsEvents.importCompleted, {
			format: 'goodreads',
			size_bucket: importSizeBucket(25),
		})
		expect(memory.events[0]?.params).not.toHaveProperty('filename')
		expect(memory.events[1]?.params?.size_bucket).toBe('11-50')
		expect(memory.events[1]?.params).not.toHaveProperty('filename')
	})

	it('tracks help with fixed section enum', () => {
		track(AnalyticsEvents.helpOpened, { section: 'ocr' })
		expect(memory.events[0]?.params).toEqual({ section: 'ocr' })
	})

	it('emits one event per logical action (no duplicate helper spam)', () => {
		track(AnalyticsEvents.bookAdded, {
			source: 'manual',
			format: 'ebook',
			initial_status: 'READING',
		})
		track(AnalyticsEvents.readingSessionStarted, { progress_mode: 'percent' })
		track(AnalyticsEvents.readingSessionFinished, {
			progress_mode: 'percent',
			duration_bucket: '<5m',
		})
		track(AnalyticsEvents.readingNoteAdded, { type: 'thought' })
		expect(memory.events).toHaveLength(4)
	})

	it('swallows track failures so UX is never blocked', () => {
		setAnalyticsAdapter({
			initialize () {},
			track () {
				throw new Error('native down')
			},
		})
		expect(() =>
			track(AnalyticsEvents.bookAdded, {
				source: 'manual',
				format: 'paper',
				initial_status: 'WANT_TO_READ',
			}),
		).not.toThrow()
	})
})

describe('banner policy matrix', () => {
	const cases: Array<{
		context: (typeof AdContexts)[keyof typeof AdContexts]
		active?: boolean
		allowed: boolean
		group?: string
	}> = [
		{ context: AdContexts.ONBOARDING, allowed: false },
		{ context: AdContexts.HOME, allowed: true, group: 'today_library' },
		{
			context: AdContexts.HOME,
			active: true,
			allowed: false,
		},
		{ context: AdContexts.LIBRARY, allowed: true, group: 'today_library' },
		{ context: AdContexts.DIARY, allowed: true, group: 'diary_stats' },
		{ context: AdContexts.STATISTICS, allowed: true, group: 'diary_stats' },
		{ context: AdContexts.MORE, allowed: true, group: 'more' },
		{ context: AdContexts.READING_SESSION, allowed: false },
		{ context: AdContexts.OCR, allowed: false },
		{ context: AdContexts.BACKUP, allowed: false },
		{ context: AdContexts.RESTORE, allowed: false },
		{ context: AdContexts.IMPORT, allowed: false },
		{ context: AdContexts.EXPORT, allowed: false },
		{ context: AdContexts.HELP, allowed: false },
		{ context: AdContexts.YEAR_IN_BOOKS, allowed: false },
		{ context: AdContexts.NOTE_EDITOR, allowed: false },
		{ context: AdContexts.BOOK_FORM, allowed: false },
		{ context: AdContexts.REMINDERS, allowed: false },
	]

	it.each(cases)(
		'$context active=$active → allowed=$allowed',
		({ context, active, allowed, group }) => {
			const result = resolveBannerPlacement({
				context,
				hasActiveReadingSession: active,
			})
			expect(result.allowed).toBe(allowed)
			if (group) {
				expect(result.group).toBe(group)
			} else {
				expect(result.group).toBeNull()
			}
		},
	)
})

describe('interstitial policy', () => {
	const t0 = 1_000_000

	it('denies fresh launch / early time / insufficient actions', () => {
		let state = createInterstitialSessionState(t0)
		expect(
			canShowInterstitial({
				state,
				context: AdContexts.LIBRARY,
				now: t0 + 60_000,
				adReady: true,
			}).eligible,
		).toBe(false)

		for (let i = 0; i < 10; i += 1) {
			state = recordMeaningfulAction(state)
		}
		expect(
			canShowInterstitial({
				state,
				context: AdContexts.LIBRARY,
				now: t0 + 60_000,
				adReady: true,
			}).reason,
		).toBe('too_early')

		state = createInterstitialSessionState(t0)
		state = recordMeaningfulAction(state)
		expect(
			canShowInterstitial({
				state,
				context: AdContexts.LIBRARY,
				now: t0 + ADS_INTERSTITIAL_MIN_ELAPSED_MS + 1,
				adReady: true,
			}).reason,
		).toBe('insufficient_actions')
	})

	it('allows whitelist context after thresholds and once only', () => {
		let state = createInterstitialSessionState(t0)
		for (let i = 0; i < ADS_INTERSTITIAL_MIN_ACTIONS; i += 1) {
			state = recordMeaningfulAction(state)
		}
		const now = t0 + ADS_INTERSTITIAL_MIN_ELAPSED_MS + 1
		expect(
			canShowInterstitial({
				state,
				context: AdContexts.LIBRARY,
				now,
				adReady: true,
			}).eligible,
		).toBe(true)

		state = markInterstitialShown(state)
		expect(
			canShowInterstitial({
				state,
				context: AdContexts.LIBRARY,
				now: now + 30 * 60_000,
				adReady: true,
			}).eligible,
		).toBe(false)
	})

	it('forbids reading / OCR / backup / help / completion contexts', () => {
		let state = createInterstitialSessionState(t0)
		for (let i = 0; i < ADS_INTERSTITIAL_MIN_ACTIONS; i += 1) {
			state = recordMeaningfulAction(state)
		}
		const now = t0 + ADS_INTERSTITIAL_MIN_ELAPSED_MS + 1
		for (const context of [
			AdContexts.READING_SESSION,
			AdContexts.OCR,
			AdContexts.BACKUP,
			AdContexts.HELP,
			AdContexts.BOOK_COMPLETION,
			AdContexts.HOME,
			AdContexts.ONBOARDING,
		] as const) {
			expect(
				canShowInterstitial({
					state,
					context,
					now,
					adReady: true,
				}).eligible,
			).toBe(false)
		}
	})
})

describe('interstitial navigation safety', () => {
	const memoryAds = createMemoryAdsAdapter({ ready: false, showSucceeds: true })
	const memoryAnalytics = createMemoryAnalyticsAdapter()

	beforeEach(() => {
		memoryAds.reset()
		memoryAnalytics.reset()
		setAdsAdapter(memoryAds)
		setAnalyticsAdapter(memoryAnalytics)
		resetAdsSession(1_000_000)
		initializeAds()
	})

	afterEach(() => {
		setAdsAdapter(null)
		setAnalyticsAdapter(null)
	})

	it('continues when ad is not ready / show fails', async () => {
		const t0 = 1_000_000
		resetAdsSession(t0)
		for (let i = 0; i < ADS_INTERSTITIAL_MIN_ACTIONS; i += 1) {
			recordMeaningfulAdAction()
		}
		memoryAds.setReady(false)
		const notReady = await tryShowInterstitial(
			AdContexts.LIBRARY,
			t0 + ADS_INTERSTITIAL_MIN_ELAPSED_MS + 1,
		)
		expect(notReady.shown).toBe(false)

		memoryAds.setReady(true)
		memoryAds.setShowSucceeds(false)
		// Failure cooldown may block immediate retry — advance time past cooldown.
		const failed = await tryShowInterstitial(
			AdContexts.DIARY,
			t0 + ADS_INTERSTITIAL_MIN_ELAPSED_MS + 70_000,
		)
		expect(failed.shown).toBe(false)
		expect(getAdsSessionState().interstitialShown).toBe(false)
	})

	it('shows once then never again; preserves session flag', async () => {
		const t0 = 2_000_000
		resetAdsSession(t0)
		for (let i = 0; i < ADS_INTERSTITIAL_MIN_ACTIONS; i += 1) {
			recordMeaningfulAdAction()
		}
		memoryAds.setReady(true)
		memoryAds.setShowSucceeds(true)
		const first = await tryShowInterstitial(
			AdContexts.STATISTICS,
			t0 + ADS_INTERSTITIAL_MIN_ELAPSED_MS + 1,
		)
		expect(first.shown).toBe(true)
		expect(getAdsSessionState().interstitialShown).toBe(true)

		memoryAds.setReady(true)
		const second = await tryShowInterstitial(
			AdContexts.MORE,
			t0 + ADS_INTERSTITIAL_MIN_ELAPSED_MS + 30 * 60_000,
		)
		expect(second.shown).toBe(false)
	})
})
