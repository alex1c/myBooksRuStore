/**
 * Reading goals repository — soft-archive via archived_at.
 */

import type { GoalPeriod, GoalType } from '@/constants/domain'
import { isGoalPeriod, isGoalType } from '@/constants/domain'
import { ReadingGoal } from '@/db/types'
import { SqlExecutor } from '@/db/sqlExecutor'
import { createId } from '@/utils/id'
import { nowIso } from '@/utils/dates'

interface GoalRow {
	id: string
	type: string
	period: string
	target_value: number
	starts_on: string
	ends_on: string | null
	created_at: string
	updated_at: string
	archived_at: string | null
}

export interface CreateGoalInput {
	type: GoalType
	period: GoalPeriod
	targetValue: number
	startsOn: string
	endsOn?: string | null
}

export type UpdateGoalInput = Partial<{
	type: GoalType
	period: GoalPeriod
	targetValue: number
	startsOn: string
	endsOn: string | null
}>

function mapGoal (row: GoalRow): ReadingGoal {
	if (!isGoalType(row.type) || !isGoalPeriod(row.period)) {
		throw new Error('INVALID_GOAL_ENUM')
	}
	return {
		id: row.id,
		type: row.type,
		period: row.period,
		targetValue: row.target_value,
		startsOn: row.starts_on,
		endsOn: row.ends_on,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		archivedAt: row.archived_at,
	}
}

export async function createReadingGoal (
	db: SqlExecutor,
	input: CreateGoalInput,
): Promise<ReadingGoal> {
	if (!isGoalType(input.type) || !isGoalPeriod(input.period)) {
		throw new Error('INVALID_GOAL_ENUM')
	}
	if (!Number.isFinite(input.targetValue) || input.targetValue <= 0) {
		throw new Error('INVALID_GOAL_TARGET')
	}

	const id = createId('goal')
	const now = nowIso()
	await db.runAsync(
		`INSERT INTO reading_goals (
			id, type, period, target_value, starts_on, ends_on,
			created_at, updated_at, archived_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
		[
			id,
			input.type,
			input.period,
			input.targetValue,
			input.startsOn,
			input.endsOn ?? null,
			now,
			now,
		],
	)
	const created = await getReadingGoalById(db, id)
	if (!created) {
		throw new Error('GOAL_CREATE_FAILED')
	}
	return created
}

export async function getReadingGoalById (
	db: SqlExecutor,
	id: string,
): Promise<ReadingGoal | null> {
	const row = await db.getFirstAsync<GoalRow>(
		`SELECT * FROM reading_goals WHERE id = ?`,
		[id],
	)
	return row ? mapGoal(row) : null
}

export async function listActiveReadingGoals (
	db: SqlExecutor,
): Promise<ReadingGoal[]> {
	const rows = await db.getAllAsync<GoalRow>(
		`SELECT * FROM reading_goals
		 WHERE archived_at IS NULL
		 ORDER BY created_at ASC`,
	)
	return rows.map(mapGoal)
}

export async function updateReadingGoal (
	db: SqlExecutor,
	id: string,
	input: UpdateGoalInput,
): Promise<ReadingGoal> {
	const existing = await getReadingGoalById(db, id)
	if (!existing) {
		throw new Error('GOAL_NOT_FOUND')
	}
	if (existing.archivedAt) {
		throw new Error('GOAL_ARCHIVED')
	}

	const type = input.type ?? existing.type
	const period = input.period ?? existing.period
	const targetValue = input.targetValue ?? existing.targetValue
	const startsOn = input.startsOn ?? existing.startsOn
	const endsOn =
		input.endsOn !== undefined ? input.endsOn : existing.endsOn

	if (!isGoalType(type) || !isGoalPeriod(period)) {
		throw new Error('INVALID_GOAL_ENUM')
	}
	if (!Number.isFinite(targetValue) || targetValue <= 0) {
		throw new Error('INVALID_GOAL_TARGET')
	}

	const now = nowIso()
	await db.runAsync(
		`UPDATE reading_goals SET
			type = ?, period = ?, target_value = ?, starts_on = ?, ends_on = ?,
			updated_at = ?
		WHERE id = ?`,
		[type, period, targetValue, startsOn, endsOn, now, id],
	)
	const updated = await getReadingGoalById(db, id)
	if (!updated) {
		throw new Error('GOAL_UPDATE_FAILED')
	}
	return updated
}

export async function archiveReadingGoal (
	db: SqlExecutor,
	id: string,
): Promise<void> {
	const existing = await getReadingGoalById(db, id)
	if (!existing) {
		throw new Error('GOAL_NOT_FOUND')
	}
	const now = nowIso()
	await db.runAsync(
		`UPDATE reading_goals SET archived_at = ?, updated_at = ? WHERE id = ?`,
		[now, now, id],
	)
}
