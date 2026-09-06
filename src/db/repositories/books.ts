import { Book } from '@/db/types'
import { SqlExecutor } from '@/db/sqlExecutor'
import { createId } from '@/utils/id'
import { nowIso } from '@/utils/dates'

interface BookRow {
	id: string
	title: string
	subtitle: string | null
	author_text: string
	description: string | null
	isbn10: string | null
	isbn13: string | null
	publisher: string | null
	published_year: number | null
	language: string | null
	page_count: number | null
	cover_uri: string | null
	source: string | null
	source_external_id: string | null
	created_at: string
	updated_at: string
	archived_at: string | null
}

export interface CreateBookInput {
	title: string
	authorText: string
	subtitle?: string | null
	description?: string | null
	isbn10?: string | null
	isbn13?: string | null
	publisher?: string | null
	publishedYear?: number | null
	language?: string | null
	pageCount?: number | null
	coverUri?: string | null
	source?: string | null
	sourceExternalId?: string | null
}

function mapBook (row: BookRow): Book {
	return {
		id: row.id,
		title: row.title,
		subtitle: row.subtitle,
		authorText: row.author_text,
		description: row.description,
		isbn10: row.isbn10,
		isbn13: row.isbn13,
		publisher: row.publisher,
		publishedYear: row.published_year,
		language: row.language,
		pageCount: row.page_count,
		coverUri: row.cover_uri,
		source: row.source,
		sourceExternalId: row.source_external_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		archivedAt: row.archived_at,
	}
}

/**
 * Creates a catalog book row. Internal ID is always locally generated.
 */
export async function createBook (
	db: SqlExecutor,
	input: CreateBookInput,
): Promise<Book> {
	const title = input.title.trim()
	const authorText = input.authorText.trim()
	if (!title) {
		throw new Error('BOOK_TITLE_REQUIRED')
	}
	if (!authorText) {
		throw new Error('BOOK_AUTHOR_REQUIRED')
	}

	const id = createId('book')
	const now = nowIso()

	await db.runAsync(
		`INSERT INTO books (
			id, title, subtitle, author_text, description,
			isbn10, isbn13, publisher, published_year, language,
			page_count, cover_uri, source, source_external_id,
			created_at, updated_at, archived_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
		[
			id,
			title,
			input.subtitle ?? null,
			authorText,
			input.description ?? null,
			input.isbn10 ?? null,
			input.isbn13 ?? null,
			input.publisher ?? null,
			input.publishedYear ?? null,
			input.language ?? null,
			input.pageCount ?? null,
			input.coverUri ?? null,
			input.source ?? null,
			input.sourceExternalId ?? null,
			now,
			now,
		],
	)

	const created = await getBookById(db, id)
	if (!created) {
		throw new Error('BOOK_CREATE_FAILED')
	}
	return created
}

export async function getBookById (
	db: SqlExecutor,
	id: string,
): Promise<Book | null> {
	const row = await db.getFirstAsync<BookRow>(
		`SELECT * FROM books WHERE id = ?`,
		[id],
	)
	return row ? mapBook(row) : null
}

export async function countBooks (db: SqlExecutor): Promise<number> {
	const row = await db.getFirstAsync<{ count: number }>(
		`SELECT COUNT(*) AS count FROM books WHERE archived_at IS NULL`,
	)
	return row?.count ?? 0
}

/**
 * Soft-archives a book. Prefer this over hard delete so history can remain.
 */
export async function archiveBook (
	db: SqlExecutor,
	id: string,
): Promise<void> {
	const now = nowIso()
	await db.runAsync(
		`UPDATE books SET archived_at = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL`,
		[now, now, id],
	)
}

/**
 * Hard-delete. Will fail with FK RESTRICT if library_entries still reference
 * the book — preserving reading history by design.
 */
export async function deleteBookHard (
	db: SqlExecutor,
	id: string,
): Promise<void> {
	await db.runAsync(`DELETE FROM books WHERE id = ?`, [id])
}
