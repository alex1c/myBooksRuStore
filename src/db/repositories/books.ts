import { Book } from '@/db/types'
import { SqlExecutor } from '@/db/sqlExecutor'
import { createId } from '@/utils/id'
import { nowIso } from '@/utils/dates'
import {
	normalizeIsbn,
	normalizeText,
	validateIsbn10,
	validateIsbn13,
	validatePublishedYear,
	validateTitle,
} from '@/domain/libraryValidation'

export interface BookRow {
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
	/** Empty string is allowed (unknown author / anthology). */
	authorText?: string | null
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

export type UpdateBookInput = Partial<CreateBookInput>

export function mapBook (row: BookRow): Book {
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

function prepareBookFields (input: CreateBookInput) {
	const titleError = validateTitle(input.title)
	if (titleError) {
		throw new Error('BOOK_TITLE_REQUIRED')
	}
	const yearError = validatePublishedYear(input.publishedYear ?? null)
	if (yearError) {
		throw new Error('INVALID_PUBLISHED_YEAR')
	}
	const isbn10Raw = input.isbn10?.trim() ? normalizeIsbn(input.isbn10) : null
	const isbn13Raw = input.isbn13?.trim() ? normalizeIsbn(input.isbn13) : null
	if (validateIsbn10(isbn10Raw)) {
		throw new Error('INVALID_ISBN10')
	}
	if (validateIsbn13(isbn13Raw)) {
		throw new Error('INVALID_ISBN13')
	}

	return {
		title: input.title.trim(),
		authorText: (input.authorText ?? '').trim(),
		subtitle: input.subtitle?.trim() ? input.subtitle.trim() : null,
		description: input.description?.trim() ? input.description.trim() : null,
		isbn10: isbn10Raw,
		isbn13: isbn13Raw,
		publisher: input.publisher?.trim() ? input.publisher.trim() : null,
		publishedYear: input.publishedYear ?? null,
		language: input.language?.trim() ? input.language.trim() : null,
		pageCount: input.pageCount ?? null,
		coverUri: input.coverUri?.trim() ? input.coverUri.trim() : null,
		source: input.source ?? null,
		sourceExternalId: input.sourceExternalId ?? null,
	}
}

/**
 * Creates a catalog book row. Internal ID is always locally generated.
 * Author may be empty for anthologies / unknown authorship.
 */
export async function createBook (
	db: SqlExecutor,
	input: CreateBookInput,
): Promise<Book> {
	const fields = prepareBookFields(input)
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
			fields.title,
			fields.subtitle,
			fields.authorText,
			fields.description,
			fields.isbn10,
			fields.isbn13,
			fields.publisher,
			fields.publishedYear,
			fields.language,
			fields.pageCount,
			fields.coverUri,
			fields.source,
			fields.sourceExternalId,
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

export async function updateBook (
	db: SqlExecutor,
	id: string,
	input: UpdateBookInput,
): Promise<Book> {
	const existing = await getBookById(db, id)
	if (!existing) {
		throw new Error('BOOK_NOT_FOUND')
	}

	const merged: CreateBookInput = {
		title: input.title ?? existing.title,
		authorText:
			input.authorText !== undefined ? input.authorText : existing.authorText,
		subtitle: input.subtitle !== undefined ? input.subtitle : existing.subtitle,
		description:
			input.description !== undefined ? input.description : existing.description,
		isbn10: input.isbn10 !== undefined ? input.isbn10 : existing.isbn10,
		isbn13: input.isbn13 !== undefined ? input.isbn13 : existing.isbn13,
		publisher:
			input.publisher !== undefined ? input.publisher : existing.publisher,
		publishedYear:
			input.publishedYear !== undefined
				? input.publishedYear
				: existing.publishedYear,
		language: input.language !== undefined ? input.language : existing.language,
		pageCount:
			input.pageCount !== undefined ? input.pageCount : existing.pageCount,
		coverUri: input.coverUri !== undefined ? input.coverUri : existing.coverUri,
		source: input.source !== undefined ? input.source : existing.source,
		sourceExternalId:
			input.sourceExternalId !== undefined
				? input.sourceExternalId
				: existing.sourceExternalId,
	}

	const fields = prepareBookFields(merged)
	const now = nowIso()

	await db.runAsync(
		`UPDATE books SET
			title = ?, subtitle = ?, author_text = ?, description = ?,
			isbn10 = ?, isbn13 = ?, publisher = ?, published_year = ?,
			language = ?, page_count = ?, cover_uri = ?, source = ?,
			source_external_id = ?, updated_at = ?
		 WHERE id = ?`,
		[
			fields.title,
			fields.subtitle,
			fields.authorText,
			fields.description,
			fields.isbn10,
			fields.isbn13,
			fields.publisher,
			fields.publishedYear,
			fields.language,
			fields.pageCount,
			fields.coverUri,
			fields.source,
			fields.sourceExternalId,
			now,
			id,
		],
	)

	const updated = await getBookById(db, id)
	if (!updated) {
		throw new Error('BOOK_UPDATE_FAILED')
	}
	return updated
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

/**
 * Find catalog books that look like duplicates of the given title/author/ISBN.
 */
export async function findSimilarBooks (
	db: SqlExecutor,
	input: {
		title: string
		authorText?: string | null
		isbn10?: string | null
		isbn13?: string | null
		excludeBookId?: string
	},
): Promise<Book[]> {
	const titleNorm = normalizeText(input.title)
	const authorNorm = normalizeText(input.authorText ?? '')
	const isbn10 = input.isbn10?.trim() ? normalizeIsbn(input.isbn10) : null
	const isbn13 = input.isbn13?.trim() ? normalizeIsbn(input.isbn13) : null

	const rows = await db.getAllAsync<BookRow>(
		`SELECT * FROM books WHERE archived_at IS NULL`,
	)

	return rows
		.map(mapBook)
		.filter((book) => {
			if (input.excludeBookId && book.id === input.excludeBookId) {
				return false
			}
			if (isbn13 && book.isbn13 && book.isbn13 === isbn13) {
				return true
			}
			if (isbn10 && book.isbn10 && book.isbn10 === isbn10) {
				return true
			}
			const sameTitle = normalizeText(book.title) === titleNorm
			const sameAuthor =
				authorNorm.length === 0 ||
				normalizeText(book.authorText) === authorNorm
			return sameTitle && sameAuthor
		})
}
