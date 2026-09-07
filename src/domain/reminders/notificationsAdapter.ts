/**
 * Mockable notifications adapter boundary (Phase 12).
 * Call setNotificationsAdapter(...) from app bootstrap or tests.
 */

import type { NotificationsAdapter } from './notificationTypes'

export type {
	NotificationsAdapter,
	NotificationPermissionStatus,
	ScheduleNotificationRequest,
	ScheduledNotificationInfo,
	WeeklyReminderTrigger,
} from './notificationTypes'

export {
	READING_REMINDER_CHANNEL_ID,
	READING_REMINDER_DATA_TYPE,
} from './constants'

let adapter: NotificationsAdapter | null = null

export function setNotificationsAdapter (
	next: NotificationsAdapter | null,
): void {
	adapter = next
}

export function getNotificationsAdapter (): NotificationsAdapter {
	if (!adapter) {
		throw new Error('NOTIFICATIONS_ADAPTER_NOT_INITIALIZED')
	}
	return adapter
}
