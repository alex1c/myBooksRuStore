import { migration001Initial } from './001_initial'
import { migration002FinishedDatePrecision } from './002_finished_date_precision'
import { migration003RemoteCoverUrl } from './003_remote_cover_url'
import { migration004ActiveSessionsAndProgressEvents } from './004_active_sessions_and_progress_events'

export interface Migration {
	version: number
	name: string
	sql: string
	/**
	 * When false, apply outside a transaction so connection-level PRAGMAs
	 * (e.g. foreign_keys OFF for table rebuild) take effect.
	 */
	transactional?: boolean
}

/**
 * Ordered list of schema migrations.
 * Append new migrations — never edit applied SQL in production.
 */
export const migrations: Migration[] = [
	{
		version: 1,
		name: '001_initial',
		sql: migration001Initial,
	},
	{
		version: 2,
		name: '002_finished_date_precision',
		sql: migration002FinishedDatePrecision,
	},
	{
		version: 3,
		name: '003_remote_cover_url',
		sql: migration003RemoteCoverUrl,
	},
	{
		version: 4,
		name: '004_active_sessions_and_progress_events',
		sql: migration004ActiveSessionsAndProgressEvents,
		transactional: false,
	},
]

export const LATEST_SCHEMA_VERSION = migrations[migrations.length - 1]?.version ?? 0
