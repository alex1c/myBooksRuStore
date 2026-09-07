/**
 * Notification adapter types (Phase 12).
 */

export type NotificationPermissionStatus =
	| 'granted'
	| 'denied'
	| 'undetermined'

export interface WeeklyReminderTrigger {
	type: 'weekly'
	weekday: number
	hour: number
	minute: number
	channelId: string
}

export interface ScheduleNotificationRequest {
	identifier?: string
	title: string
	body: string
	data: Record<string, unknown>
	trigger: WeeklyReminderTrigger
}

export interface ScheduledNotificationInfo {
	identifier: string
	weekday?: number
	hour?: number
	minute?: number
	channelId?: string
	data?: Record<string, unknown>
}

export interface NotificationsAdapter {
	getPermissionStatus (): Promise<NotificationPermissionStatus>
	requestPermission (): Promise<NotificationPermissionStatus>
	ensureAndroidChannel (): Promise<void>
	scheduleNotification (request: ScheduleNotificationRequest): Promise<string>
	cancelScheduledNotification (identifier: string): Promise<void>
	cancelScheduledNotifications (identifiers: string[]): Promise<void>
	getScheduledNotifications (): Promise<ScheduledNotificationInfo[]>
	openSystemSettings (): Promise<void>
}
