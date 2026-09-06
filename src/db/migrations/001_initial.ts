/**
 * Migration 001 — Phase 1 foundation schema for «Дневник чтения».
 *
 * Design notes:
 * - All entity PKs are opaque TEXT IDs (not SQLite autoincrement).
 * - Timestamps are ISO-8601 UTC TEXT.
 * - Soft-archive via archived_at where history must survive.
 * - Foreign keys use RESTRICT for history-sensitive parents;
 *   junction tables may CASCADE.
 */

export const migration001Initial = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
	version INTEGER PRIMARY KEY NOT NULL,
	applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_meta (
	key TEXT PRIMARY KEY NOT NULL,
	value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS books (
	id TEXT PRIMARY KEY NOT NULL,
	title TEXT NOT NULL,
	subtitle TEXT,
	author_text TEXT NOT NULL,
	description TEXT,
	isbn10 TEXT,
	isbn13 TEXT,
	publisher TEXT,
	published_year INTEGER,
	language TEXT,
	page_count INTEGER,
	cover_uri TEXT,
	source TEXT,
	source_external_id TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author_text);
CREATE INDEX IF NOT EXISTS idx_books_isbn13 ON books(isbn13);
CREATE INDEX IF NOT EXISTS idx_books_archived_at ON books(archived_at);

CREATE TABLE IF NOT EXISTS library_entries (
	id TEXT PRIMARY KEY NOT NULL,
	book_id TEXT NOT NULL,
	status TEXT NOT NULL,
	format TEXT NOT NULL,
	progress_mode TEXT NOT NULL,
	current_page INTEGER,
	total_pages INTEGER,
	current_percent REAL,
	audio_position_seconds INTEGER,
	audio_duration_seconds INTEGER,
	started_at TEXT,
	finished_at TEXT,
	rating INTEGER,
	review_text TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	archived_at TEXT,
	FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_library_entries_book_id
	ON library_entries(book_id);
CREATE INDEX IF NOT EXISTS idx_library_entries_status
	ON library_entries(status);
CREATE INDEX IF NOT EXISTS idx_library_entries_archived_at
	ON library_entries(archived_at);
CREATE INDEX IF NOT EXISTS idx_library_entries_updated_at
	ON library_entries(updated_at);

CREATE TABLE IF NOT EXISTS reading_sessions (
	id TEXT PRIMARY KEY NOT NULL,
	library_entry_id TEXT NOT NULL,
	started_at TEXT NOT NULL,
	ended_at TEXT NOT NULL,
	duration_seconds INTEGER NOT NULL,
	start_page INTEGER,
	end_page INTEGER,
	start_percent REAL,
	end_percent REAL,
	start_audio_seconds INTEGER,
	end_audio_seconds INTEGER,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (library_entry_id) REFERENCES library_entries(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_reading_sessions_library_entry_id
	ON reading_sessions(library_entry_id);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_started_at
	ON reading_sessions(started_at);

CREATE TABLE IF NOT EXISTS reading_notes (
	id TEXT PRIMARY KEY NOT NULL,
	library_entry_id TEXT NOT NULL,
	reading_session_id TEXT,
	type TEXT NOT NULL,
	text TEXT NOT NULL,
	page INTEGER,
	percent REAL,
	audio_position_seconds INTEGER,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (library_entry_id) REFERENCES library_entries(id) ON DELETE RESTRICT,
	FOREIGN KEY (reading_session_id) REFERENCES reading_sessions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_reading_notes_library_entry_id
	ON reading_notes(library_entry_id);
CREATE INDEX IF NOT EXISTS idx_reading_notes_session_id
	ON reading_notes(reading_session_id);
CREATE INDEX IF NOT EXISTS idx_reading_notes_created_at
	ON reading_notes(created_at);
CREATE INDEX IF NOT EXISTS idx_reading_notes_type
	ON reading_notes(type);

CREATE TABLE IF NOT EXISTS shelves (
	id TEXT PRIMARY KEY NOT NULL,
	name TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_shelves_name ON shelves(name);
CREATE INDEX IF NOT EXISTS idx_shelves_archived_at ON shelves(archived_at);

CREATE TABLE IF NOT EXISTS library_entry_shelves (
	library_entry_id TEXT NOT NULL,
	shelf_id TEXT NOT NULL,
	created_at TEXT NOT NULL,
	PRIMARY KEY (library_entry_id, shelf_id),
	FOREIGN KEY (library_entry_id) REFERENCES library_entries(id) ON DELETE CASCADE,
	FOREIGN KEY (shelf_id) REFERENCES shelves(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_library_entry_shelves_shelf_id
	ON library_entry_shelves(shelf_id);
CREATE INDEX IF NOT EXISTS idx_library_entry_shelves_entry_id
	ON library_entry_shelves(library_entry_id);

CREATE TABLE IF NOT EXISTS reading_goals (
	id TEXT PRIMARY KEY NOT NULL,
	type TEXT NOT NULL,
	period TEXT NOT NULL,
	target_value REAL NOT NULL,
	starts_on TEXT NOT NULL,
	ends_on TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_reading_goals_type_period
	ON reading_goals(type, period);
CREATE INDEX IF NOT EXISTS idx_reading_goals_starts_on
	ON reading_goals(starts_on);
CREATE INDEX IF NOT EXISTS idx_reading_goals_archived_at
	ON reading_goals(archived_at);
`
