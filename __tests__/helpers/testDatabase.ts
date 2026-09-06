import Database from 'better-sqlite3'

import { SqlExecutor, SqlParams } from '../../src/db/sqlExecutor'

/**
 * Node/Jest SQLite adapter mirroring the Expo SQL executor surface.
 */
export function createTestSqlExecutor (filename = ':memory:'): SqlExecutor {
	const db = new Database(filename)
	db.pragma('foreign_keys = ON')

	const ensureForeignKeys = () => {
		// Some multi-statement exec paths can leave FK enforcement ambiguous; force ON.
		db.pragma('foreign_keys = ON')
	}

	return {
		async execAsync (source: string) {
			ensureForeignKeys()
			db.exec(source)
			ensureForeignKeys()
		},
		async runAsync (source: string, params: SqlParams = []) {
			ensureForeignKeys()
			const result = db.prepare(source).run(...params)
			return {
				changes: result.changes,
				lastInsertRowId: Number(result.lastInsertRowid),
			}
		},
		async getFirstAsync<T> (source: string, params: SqlParams = []) {
			ensureForeignKeys()
			const row = db.prepare(source).get(...params)
			return (row as T) ?? null
		},
		async getAllAsync<T> (source: string, params: SqlParams = []) {
			ensureForeignKeys()
			return db.prepare(source).all(...params) as T[]
		},
		async withTransactionAsync<T> (task: () => Promise<T>) {
			ensureForeignKeys()
			db.exec('BEGIN')
			try {
				const value = await task()
				db.exec('COMMIT')
				return value
			} catch (error) {
				db.exec('ROLLBACK')
				throw error
			}
		},
	}
}
