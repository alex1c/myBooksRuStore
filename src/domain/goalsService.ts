/**
 * Goals service — create/edit/archive + progress from real reading events.
 */

import type { GoalPeriod, GoalType } from '@/constants/domain'
import { isGoalPeriod, isGoalType } from '@/constants/domain'
import {
	archiveReadingGoal,
	createReadingGoal,
	getReadingGoalById,
	listActiveReadingGoals,
	updateReadingGoal,
} from '@/db/repositories/readingGoals'
import { SqlExecutor } from '@/db/sqlExecutor'
import type { ReadingGoal } from '@/db/types'
import {
	getBooksFinishedInRange,
	getPageDeltaInRange,
	getSessionSecondsInRange,
} from '@/domain/activityService'
import { toDateOnlyLocal } from '@/utils/dates'
import { periodRangeFor } from '@/utils/period'

export interface GoalProgress {
	goal: ReadingGoal
	current: number
	target: number
	unitLabel: string
	periodLabel: string
	remaining: number
	completed: boolean
	overTarget: boolean
	/** 0–1 for bar (capped). */
	ratio: number
	summary: string
	periodStart: string
	periodEnd: string
}

export interface CreateGoalParams {
	type: GoalType
	period: GoalPeriod
	targetValue: number
}

const MAX_TARGET = 1_000_000

export function validateGoalCombo (
	type: GoalType,
	period: GoalPeriod,
): string | null {
	if (type === 'BOOKS' && (period === 'DAY' || period === 'WEEK')) {
		return 'Цель по книгам лучше ставить на месяц или год.'
	}
	return null
}

export async function createGoal (
	db: SqlExecutor,
	input: CreateGoalParams,
	now: Date = new Date(),
): Promise<ReadingGoal> {
	if (!isGoalType(input.type) || !isGoalPeriod(input.period)) {
		throw new Error('INVALID_GOAL_ENUM')
	}
	if (
		!Number.isInteger(input.targetValue) ||
		input.targetValue <= 0 ||
		input.targetValue > MAX_TARGET
	) {
		throw new Error('INVALID_GOAL_TARGET')
	}
	const comboError = validateGoalCombo(input.type, input.period)
	if (comboError) {
		throw new Error(`INVALID_GOAL_COMBO:${comboError}`)
	}

	const today = toDateOnlyLocal(now)
	return createReadingGoal(db, {
		type: input.type,
		period: input.period,
		targetValue: input.targetValue,
		startsOn: today,
		endsOn: null,
	})
}

export async function editGoal (
	db: SqlExecutor,
	id: string,
	input: Partial<CreateGoalParams>,
): Promise<ReadingGoal> {
	const existing = await getReadingGoalById(db, id)
	if (!existing) {
		throw new Error('GOAL_NOT_FOUND')
	}
	const type = input.type ?? existing.type
	const period = input.period ?? existing.period
	const targetValue = input.targetValue ?? existing.targetValue
	const comboError = validateGoalCombo(type, period)
	if (comboError) {
		throw new Error(`INVALID_GOAL_COMBO:${comboError}`)
	}
	return updateReadingGoal(db, id, { type, period, targetValue })
}

export async function deactivateGoal (
	db: SqlExecutor,
	id: string,
): Promise<void> {
	await archiveReadingGoal(db, id)
}

export async function listGoalProgress (
	db: SqlExecutor,
	now: Date = new Date(),
): Promise<GoalProgress[]> {
	const goals = await listActiveReadingGoals(db)
	const results: GoalProgress[] = []
	for (const goal of goals) {
		results.push(await computeGoalProgress(db, goal, now))
	}
	return results
}

export async function computeGoalProgress (
	db: SqlExecutor,
	goal: ReadingGoal,
	now: Date = new Date(),
): Promise<GoalProgress> {
	const today = toDateOnlyLocal(now)
	const range = periodRangeFor(goal.period, today)
	let current = 0

	if (goal.type === 'PAGES') {
		current = await getPageDeltaInRange(db, range.startKey, range.endKey)
	} else if (goal.type === 'MINUTES') {
		const seconds = await getSessionSecondsInRange(
			db,
			range.startKey,
			range.endKey,
		)
		current = Math.floor(seconds / 60)
	} else {
		const allowYear =
			goal.period === 'YEAR' &&
			range.startKey.endsWith('-01-01') &&
			range.endKey.endsWith('-12-31')
		const year = Number.parseInt(range.startKey.slice(0, 4), 10)
		current = await getBooksFinishedInRange(db, range.startKey, range.endKey, {
			allowYearPrecision: allowYear,
			year,
		})
	}

	const target = goal.targetValue
	const completed = current >= target
	const overTarget = current > target
	const remaining = Math.max(0, target - current)
	const unitLabel = unitFor(goal.type)
	const periodLabel = periodLabelFor(goal.period)
	const summary = completed
		? overTarget
			? `${current} / ${target} · Перевыполнено`
			: `${current} / ${target} · Выполнено`
		: `${current} / ${target}`

	return {
		goal,
		current,
		target,
		unitLabel,
		periodLabel,
		remaining,
		completed,
		overTarget,
		ratio: target > 0 ? Math.min(1, current / target) : 0,
		summary,
		periodStart: range.startKey,
		periodEnd: range.endKey,
	}
}

function unitFor (type: GoalType): string {
	if (type === 'PAGES') {
		return 'страниц'
	}
	if (type === 'MINUTES') {
		return 'минут'
	}
	return 'книг'
}

function periodLabelFor (period: GoalPeriod): string {
	if (period === 'DAY') {
		return 'в день'
	}
	if (period === 'WEEK') {
		return 'в неделю'
	}
	if (period === 'MONTH') {
		return 'в месяц'
	}
	return 'в год'
}

export function goalTitle (goal: ReadingGoal): string {
	return `${goal.targetValue} ${unitFor(goal.type)} ${periodLabelFor(goal.period)}`
}

/** Daily/weekly goals for the Today compact strip. */
export async function listTodayMotivationGoals (
	db: SqlExecutor,
	now: Date = new Date(),
): Promise<GoalProgress[]> {
	const all = await listGoalProgress(db, now)
	return all.filter(
		(g) => g.goal.period === 'DAY' || g.goal.period === 'WEEK',
	)
}

export async function findSimilarActiveGoal (
	db: SqlExecutor,
	type: GoalType,
	period: GoalPeriod,
	targetValue: number,
): Promise<ReadingGoal | null> {
	const goals = await listActiveReadingGoals(db)
	return (
		goals.find(
			(g) =>
				g.type === type &&
				g.period === period &&
				g.targetValue === targetValue,
		) ?? null
	)
}
