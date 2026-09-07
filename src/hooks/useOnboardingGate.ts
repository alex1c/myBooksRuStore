/**
 * After DB is ready, send first-launch users to onboarding once.
 */

import { router, usePathname, useSegments } from 'expo-router'
import { useEffect, useRef } from 'react'

import { useDatabase } from '@/context/DatabaseContext'
import { shouldShowOnboarding } from '@/domain/help/onboardingService'

/**
 * Redirects to /onboarding when settings say it is not completed.
 * Skips if already on onboarding or help routes.
 */
export function useOnboardingGate (enabled: boolean): void {
	const { executor } = useDatabase()
	const pathname = usePathname()
	const segments = useSegments()
	const checked = useRef(false)

	useEffect(() => {
		if (!enabled || checked.current) {
			return
		}
		const onOnboarding = segments[0] === 'onboarding' ||
			pathname.includes('onboarding')
		if (onOnboarding) {
			return
		}

		let cancelled = false
		void (async () => {
			const show = await shouldShowOnboarding(executor)
			if (cancelled) {
				return
			}
			checked.current = true
			if (show) {
				router.replace('/onboarding')
			}
		})()

		return () => {
			cancelled = true
		}
	}, [enabled, executor, pathname, segments])
}
