/**
 * Statistics period ranges (rolling / calendar year / lifetime).
 */

import { toDateOnlyLocal } from '@/utils/dates'
import {
	addLocalDays,
	endOfYear,
	startOfYear,
	type PeriodRange,
} from '@/utils/period'

export type StatsPeriodKind = 'D7' | 'D30' | 'D90' | 'YEAR' | 'ALL'

export interface StatsPeriodRange extends PeriodRange {
	kind: StatsPeriodKind
	/** Calendar year when kind === YEAR. */
	year?: number
	/** False for ALL (open-ended history). */
	bounded: boolean
}

/**
 * Resolve inclusive local-day range for a statistics period.
 * Rolling windows include today.
 */
export function resolveStatsPeriod (
	kind: StatsPeriodKind,
	now: Date = new Date(),
	year?: number,
): StatsPeriodRange {
	const today = toDateOnlyLocal(now)

	if (kind === 'D7') {
		return {
			kind,
			startKey: addLocalDays(today, -6),
			endKey: today,
			bounded: true,
		}
	}
	if (kind === 'D30') {
		return {
			kind,
			startKey: addLocalDays(today, -29),
			endKey: today,
			bounded: true,
		}
	}
	if (kind === 'D90') {
		return {
			kind,
			startKey: addLocalDays(today, -89),
			endKey: today,
			bounded: true,
		}
	}
	if (kind === 'YEAR') {
		const y = year ?? now.getFullYear()
		const anchor = `${y}-06-15`
		return {
			kind,
			startKey: startOfYear(anchor),
			endKey: endOfYear(anchor),
			year: y,
			bounded: true,
		}
	}

	// ALL — use a wide practical window; queries still filter correctly.
	return {
		kind,
		startKey: '1970-01-01',
		endKey: today,
		bounded: false,
	}
}
