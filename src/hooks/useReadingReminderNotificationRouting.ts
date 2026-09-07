/**
 * Handle reading-reminder notification taps → Today tab (once).
 */

import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { useEffect, useRef } from 'react'

import { READING_REMINDER_DATA_TYPE } from '@/domain/reminders/constants'
import { extractNotificationResponseData } from '@/domain/reminders/expoNotificationsAdapter'

function routeToTodayIfReminder (data: {
	type: string | null
}): void {
	if (data.type !== READING_REMINDER_DATA_TYPE) {
		return
	}
	router.replace('/(tabs)')
}

/**
 * Subscribe to notification responses after navigation is ready.
 * Deduplicates cold-start + listener double delivery.
 */
export function useReadingReminderNotificationRouting (
	enabled: boolean,
): void {
	const handledIds = useRef(new Set<string>())

	useEffect(() => {
		if (!enabled) {
			return
		}

		const handle = (
			response: Notifications.NotificationResponse | null,
		) => {
			if (!response) {
				return
			}
			const id = response.notification.request.identifier
			if (handledIds.current.has(id)) {
				return
			}
			const extracted = extractNotificationResponseData(response)
			if (!extracted) {
				return
			}
			handledIds.current.add(id)
			routeToTodayIfReminder(extracted)
		}

		void Notifications.getLastNotificationResponseAsync().then(handle)

		const sub = Notifications.addNotificationResponseReceivedListener(
			handle,
		)
		return () => {
			sub.remove()
		}
	}, [enabled])
}
