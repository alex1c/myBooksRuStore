import * as SQLite from 'expo-sqlite'

import { applyMigrations, getSchemaVersion } from './migrations/applyMigrations'
import { ensureAppSettings } from './repositories/settings'
import { SqlExecutor, SqlParams } from './sqlExecutor'

const DATABASE_NAME = 'mybooks.db'

export interface InitializedDatabase {
	db: SQLite.SQLiteDatabase
	executor: SqlExecutor
	schemaVersion: number
}

/**
 * Opens SQLite, enables foreign keys + WAL, applies migrations, ensures settings.
 * Call once during controlled app startup before rendering main UI.
 * No network dependency — offline-first startup.
 */
export async function initializeDatabase (): Promise<InitializedDatabase> {
	const db = await SQLite.openDatabaseAsync(DATABASE_NAME)
	const executor = createExpoSqlExecutor(db)

	await executor.execAsync(`
		PRAGMA foreign_keys = ON;
		PRAGMA journal_mode = WAL;
	`)

	const schemaVersion = await applyMigrations(executor)
	await ensureAppSettings(executor)

	return { db, executor, schemaVersion }
}

/**
 * Test / recovery helper — closes and deletes the on-device database file.
 * Not used by production UI paths.
 */
export async function deleteDatabaseForTests (): Promise<void> {
	await SQLite.deleteDatabaseAsync(DATABASE_NAME)
}

export function createExpoSqlExecutor (
	db: SQLite.SQLiteDatabase,
): SqlExecutor {
	// Serialize transactions so concurrent UI actions cannot interleave writes.
	let transactionTail: Promise<void> = Promise.resolve()
	const executor: SqlExecutor = {
		execAsync: (source) => db.execAsync(source),
		runAsync: async (source, params = []) => {
			const result = await db.runAsync(source, params)
			return {
				changes: result.changes,
				lastInsertRowId: result.lastInsertRowId,
			}
		},
		getFirstAsync: <T>(source: string, params: SqlParams = []) =>
			db.getFirstAsync<T>(source, params),
		getAllAsync: <T>(source: string, params: SqlParams = []) =>
			db.getAllAsync<T>(source, params),
		withTransactionAsync: <T>(task: () => Promise<T>): Promise<T> => {
			const transaction = transactionTail.then(async () => {
				let result!: T
				await db.withTransactionAsync(async () => {
					result = await task()
				})
				return result
			})
			transactionTail = transaction.then(() => undefined, () => undefined)
			return transaction
		},
	}
	return executor
}

export { getSchemaVersion }
export type { SqlExecutor }
