/**
 * Expo Notifications production adapter (local notifications only — no push tokens).
 */

import * as Linking from 'expo-linking'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

import { READING_REMINDER_CHANNEL_ID } from './constants'
import type {
	NotificationsAdapter,
	NotificationPermissionStatus,
	ScheduleNotificationRequest,
	ScheduledNotificationInfo,
} from './notificationTypes'

function mapPermission (
	status: Notifications.PermissionStatus,
): NotificationPermissionStatus {
	if (status === 'granted') {
		return 'granted'
	}
	if (status === 'denied') {
		return 'denied'
	}
	return 'undetermined'
}

export function createExpoNotificationsAdapter (): NotificationsAdapter {
	return {
		async getPermissionStatus () {
			const current = await Notifications.getPermissionsAsync()
			return mapPermission(current.status)
		},

		async requestPermission () {
			const current = await Notifications.getPermissionsAsync()
			if (current.status === 'granted') {
				return 'granted'
			}
			const requested = await Notifications.requestPermissionsAsync()
			return mapPermission(requested.status)
		},

		async ensureAndroidChannel () {
			if (Platform.OS !== 'android') {
				return
			}
			await Notifications.setNotificationChannelAsync(
				READING_REMINDER_CHANNEL_ID,
				{
					name: 'Напоминания о чтении',
					description:
						'Напоминания о запланированном времени чтения',
					importance: Notifications.AndroidImportance.DEFAULT,
					sound: 'default',
				},
			)
		},

		async scheduleNotification (request: ScheduleNotificationRequest) {
			const id = await Notifications.scheduleNotificationAsync({
				identifier: request.identifier,
				content: {
					title: request.title,
					body: request.body,
					data: request.data,
					sound: true,
				},
				trigger: {
					type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
					weekday: request.trigger.weekday,
					hour: request.trigger.hour,
					minute: request.trigger.minute,
					channelId: request.trigger.channelId,
				},
			})
			return id
		},

		async cancelScheduledNotification (identifier: string) {
			await Notifications.cancelScheduledNotificationAsync(identifier)
		},

		async cancelScheduledNotifications (identifiers: string[]) {
			for (const id of identifiers) {
				await Notifications.cancelScheduledNotificationAsync(id)
			}
		},

		async getScheduledNotifications () {
			const all = await Notifications.getAllScheduledNotificationsAsync()
			return all.map((item): ScheduledNotificationInfo => {
				const trigger = item.trigger as {
					type?: string
					weekday?: number
					hour?: number
					minute?: number
				} | null
				return {
					identifier: item.identifier,
					weekday:
						trigger && typeof trigger.weekday === 'number'
							? trigger.weekday
							: undefined,
					hour:
						trigger && typeof trigger.hour === 'number'
							? trigger.hour
							: undefined,
					minute:
						trigger && typeof trigger.minute === 'number'
							? trigger.minute
							: undefined,
					data: (item.content.data ?? {}) as Record<string, unknown>,
				}
			})
		},

		async openSystemSettings () {
			await Linking.openSettings()
		},
	}
}

/**
 * Configure foreground presentation — quiet when already in the app.
 */
export function configureForegroundNotificationHandler (): void {
	Notifications.setNotificationHandler({
		handleNotification: async () => ({
			shouldShowBanner: false,
			shouldShowList: false,
			shouldPlaySound: false,
			shouldSetBadge: false,
		}),
	})
}

export function extractNotificationResponseData (
	response: Notifications.NotificationResponse | null,
): { type: string | null; data: Record<string, unknown> } | null {
	if (!response) {
		return null
	}
	const data = (response.notification.request.content.data ?? {}) as Record<
		string,
		unknown
	>
	const type = typeof data.type === 'string' ? data.type : null
	return { type, data }
}
