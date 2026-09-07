/**
 * Weekday mapping: ISO Mon-first (UI) ↔ Expo weekly trigger (1=Sunday … 7=Saturday).
 */

/** UI / storage: Monday = 1 … Sunday = 7 */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

/**
 * Expo Notifications WeeklyTriggerInput weekday:
 * 1 = Sunday, 2 = Monday, … 7 = Saturday.
 */
export type ExpoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** Convert ISO Mon=1…Sun=7 → Expo Sun=1…Sat=7. */
export function isoWeekdayToExpo (iso: number): ExpoWeekday {
	if (!Number.isInteger(iso) || iso < 1 || iso > 7) {
		throw new Error('INVALID_ISO_WEEKDAY')
	}
	// Mon(1)→2 … Sat(6)→7, Sun(7)→1
	return (iso === 7 ? 1 : iso + 1) as ExpoWeekday
}

/** Convert Expo Sun=1…Sat=7 → ISO Mon=1…Sun=7. */
export function expoWeekdayToIso (expo: number): IsoWeekday {
	if (!Number.isInteger(expo) || expo < 1 || expo > 7) {
		throw new Error('INVALID_EXPO_WEEKDAY')
	}
	// Sun(1)→7, Mon(2)→1 … Sat(7)→6
	return (expo === 1 ? 7 : expo - 1) as IsoWeekday
}

export const ISO_WEEKDAY_LABELS_RU: Record<IsoWeekday, string> = {
	1: 'Пн',
	2: 'Вт',
	3: 'Ср',
	4: 'Чт',
	5: 'Пт',
	6: 'Сб',
	7: 'Вс',
}

export const ISO_WEEKDAY_A11Y_RU: Record<IsoWeekday, string> = {
	1: 'Понедельник',
	2: 'Вторник',
	3: 'Среда',
	4: 'Четверг',
	5: 'Пятница',
	6: 'Суббота',
	7: 'Воскресенье',
}

export const ALL_ISO_WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7]
