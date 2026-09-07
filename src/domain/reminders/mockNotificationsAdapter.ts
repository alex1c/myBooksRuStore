/**
 * In-memory / Jest notifications adapter.
 */

import type {
	NotificationsAdapter,
	NotificationPermissionStatus,
	ScheduleNotificationRequest,
	ScheduledNotificationInfo,
} from './notificationTypes'

export interface MockNotificationsState {
	permission: NotificationPermissionStatus
	scheduled: ScheduledNotificationInfo[]
	scheduleFailOnce?: boolean
	openSettingsCalls: number
}

export function createMockNotificationsAdapter (
	initial: Partial<MockNotificationsState> = {},
): { adapter: NotificationsAdapter; state: MockNotificationsState } {
	const state: MockNotificationsState = {
		permission: initial.permission ?? 'granted',
		scheduled: [...(initial.scheduled ?? [])],
		scheduleFailOnce: initial.scheduleFailOnce,
		openSettingsCalls: 0,
	}

	const adapter: NotificationsAdapter = {
		async getPermissionStatus () {
			return state.permission
		},
		async requestPermission () {
			if (state.permission === 'undetermined') {
				state.permission = 'granted'
			}
			return state.permission
		},
		async ensureAndroidChannel () {
			// no-op
		},
		async scheduleNotification (request: ScheduleNotificationRequest) {
			if (state.scheduleFailOnce) {
				state.scheduleFailOnce = false
				throw new Error('SCHEDULE_FAIL')
			}
			const identifier =
				request.identifier ??
				`mock-${request.trigger.weekday}-${Date.now()}`
			state.scheduled.push({
				identifier,
				weekday: request.trigger.weekday,
				hour: request.trigger.hour,
				minute: request.trigger.minute,
				channelId: request.trigger.channelId,
				data: request.data,
			})
			return identifier
		},
		async cancelScheduledNotification (identifier: string) {
			state.scheduled = state.scheduled.filter(
				(s) => s.identifier !== identifier,
			)
		},
		async cancelScheduledNotifications (identifiers: string[]) {
			const set = new Set(identifiers)
			state.scheduled = state.scheduled.filter(
				(s) => !set.has(s.identifier),
			)
		},
		async getScheduledNotifications () {
			return [...state.scheduled]
		},
		async openSystemSettings () {
			state.openSettingsCalls += 1
		},
	}

	return { adapter, state }
}
