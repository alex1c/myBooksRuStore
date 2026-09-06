import { Shelf } from '@/db/types'
import { SqlExecutor } from '@/db/sqlExecutor'
import { createId } from '@/utils/id'
import { nowIso } from '@/utils/dates'
import { validateShelfName } from '@/domain/libraryValidation'

interface ShelfRow {
	id: string
	name: string
	created_at: string
	updated_at: string
	archived_at: string | null
}

function mapShelf (row: ShelfRow): Shelf {
	return {
		id: row.id,
		name: row.name,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		archivedAt: row.archived_at,
	}
}

export async function createShelf (
	db: SqlExecutor,
	name: string,
): Promise<Shelf> {
	const error = validateShelfName(name)
	if (error) {
		throw new Error('SHELF_NAME_REQUIRED')
	}
	const id = createId('shelf')
	const now = nowIso()
	await db.runAsync(
		`INSERT INTO shelves (id, name, created_at, updated_at, archived_at)
		 VALUES (?, ?, ?, ?, NULL)`,
		[id, name.trim(), now, now],
	)
	const created = await getShelfById(db, id)
	if (!created) {
		throw new Error('SHELF_CREATE_FAILED')
	}
	return created
}

export async function renameShelf (
	db: SqlExecutor,
	id: string,
	name: string,
): Promise<Shelf> {
	const error = validateShelfName(name)
	if (error) {
		throw new Error('SHELF_NAME_REQUIRED')
	}
	const now = nowIso()
	await db.runAsync(
		`UPDATE shelves SET name = ?, updated_at = ? WHERE id = ?`,
		[name.trim(), now, id],
	)
	const updated = await getShelfById(db, id)
	if (!updated) {
		throw new Error('SHELF_NOT_FOUND')
	}
	return updated
}

export async function archiveShelf (
	db: SqlExecutor,
	id: string,
): Promise<void> {
	const now = nowIso()
	await db.runAsync(
		`UPDATE shelves SET archived_at = ?, updated_at = ?
		 WHERE id = ? AND archived_at IS NULL`,
		[now, now, id],
	)
}

export async function getShelfById (
	db: SqlExecutor,
	id: string,
): Promise<Shelf | null> {
	const row = await db.getFirstAsync<ShelfRow>(
		`SELECT * FROM shelves WHERE id = ?`,
		[id],
	)
	return row ? mapShelf(row) : null
}

export async function listActiveShelves (db: SqlExecutor): Promise<Shelf[]> {
	const rows = await db.getAllAsync<ShelfRow>(
		`SELECT * FROM shelves
		 WHERE archived_at IS NULL
		 ORDER BY name COLLATE NOCASE ASC`,
	)
	return rows.map(mapShelf)
}

export async function attachEntryToShelf (
	db: SqlExecutor,
	libraryEntryId: string,
	shelfId: string,
): Promise<void> {
	const now = nowIso()
	await db.runAsync(
		`INSERT OR IGNORE INTO library_entry_shelves
			(library_entry_id, shelf_id, created_at)
		 VALUES (?, ?, ?)`,
		[libraryEntryId, shelfId, now],
	)
}

export async function detachEntryFromShelf (
	db: SqlExecutor,
	libraryEntryId: string,
	shelfId: string,
): Promise<void> {
	await db.runAsync(
		`DELETE FROM library_entry_shelves
		 WHERE library_entry_id = ? AND shelf_id = ?`,
		[libraryEntryId, shelfId],
	)
}

/** Replace all shelf links for an entry (used inside transactional updates). */
export async function setEntryShelves (
	db: SqlExecutor,
	libraryEntryId: string,
	shelfIds: string[],
): Promise<void> {
	await db.runAsync(
		`DELETE FROM library_entry_shelves WHERE library_entry_id = ?`,
		[libraryEntryId],
	)
	const now = nowIso()
	for (const shelfId of shelfIds) {
		const shelf = await db.getFirstAsync<{ id: string }>(
			`SELECT id FROM shelves WHERE id = ? LIMIT 1`,
			[shelfId],
		)
		if (!shelf) {
			throw new Error('SHELF_NOT_FOUND')
		}
		await db.runAsync(
			`INSERT INTO library_entry_shelves
				(library_entry_id, shelf_id, created_at)
			 VALUES (?, ?, ?)`,
			[libraryEntryId, shelfId, now],
		)
	}
}

export async function listShelfIdsForEntry (
	db: SqlExecutor,
	libraryEntryId: string,
): Promise<string[]> {
	const rows = await db.getAllAsync<{ shelf_id: string }>(
		`SELECT shelf_id FROM library_entry_shelves WHERE library_entry_id = ?`,
		[libraryEntryId],
	)
	return rows.map((row) => row.shelf_id)
}

export async function listEntryIdsForShelf (
	db: SqlExecutor,
	shelfId: string,
): Promise<string[]> {
	const rows = await db.getAllAsync<{ library_entry_id: string }>(
		`SELECT library_entry_id FROM library_entry_shelves WHERE shelf_id = ?`,
		[shelfId],
	)
	return rows.map((row) => row.library_entry_id)
}
