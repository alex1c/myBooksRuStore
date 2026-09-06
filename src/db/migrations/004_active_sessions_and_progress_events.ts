/**
 * Migration 004 — active reading sessions + progress event audit trail.
 *
 * - `ended_at` / `duration_seconds` become nullable so an unfinished session
 *   can persist across app kills (`ended_at IS NULL` = active).
 * - Partial unique index enforces at most one active session.
 * - `reading_progress_events` records quick/manual/session/finish updates
 *   for undo and future diary/statistics (without fake 0-second sessions).
 *
 * Must run outside a SQLite transaction so `PRAGMA foreign_keys = OFF`
 * takes effect while recreating `reading_sessions`.
 */

export const migration004ActiveSessionsAndProgressEvents = `
PRAGMA foreign_keys = OFF;

CREATE TABLE reading_sessions_new (
	id TEXT PRIMARY KEY NOT NULL,
	library_entry_id TEXT NOT NULL,
	started_at TEXT NOT NULL,
	ended_at TEXT,
	duration_seconds INTEGER,
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

INSERT INTO reading_sessions_new (
	id, library_entry_id, started_at, ended_at, duration_seconds,
	start_page, end_page, start_percent, end_percent,
	start_audio_seconds, end_audio_seconds, created_at, updated_at
)
SELECT
	id, library_entry_id, started_at, ended_at, duration_seconds,
	start_page, end_page, start_percent, end_percent,
	start_audio_seconds, end_audio_seconds, created_at, updated_at
FROM reading_sessions;

DROP TABLE reading_sessions;
ALTER TABLE reading_sessions_new RENAME TO reading_sessions;

CREATE INDEX IF NOT EXISTS idx_reading_sessions_library_entry_id
	ON reading_sessions(library_entry_id);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_started_at
	ON reading_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_ended_at
	ON reading_sessions(ended_at);

-- At most one unfinished session app-wide (Phase 4 product rule).
CREATE UNIQUE INDEX IF NOT EXISTS idx_reading_sessions_one_active
	ON reading_sessions((1))
	WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS reading_progress_events (
	id TEXT PRIMARY KEY NOT NULL,
	library_entry_id TEXT NOT NULL,
	reading_session_id TEXT,
	type TEXT NOT NULL,
	previous_page INTEGER,
	new_page INTEGER,
	previous_percent REAL,
	new_percent REAL,
	previous_audio_seconds INTEGER,
	new_audio_seconds INTEGER,
	created_at TEXT NOT NULL,
	FOREIGN KEY (library_entry_id) REFERENCES library_entries(id) ON DELETE RESTRICT,
	FOREIGN KEY (reading_session_id) REFERENCES reading_sessions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_reading_progress_events_entry_id
	ON reading_progress_events(library_entry_id);
CREATE INDEX IF NOT EXISTS idx_reading_progress_events_created_at
	ON reading_progress_events(created_at);
CREATE INDEX IF NOT EXISTS idx_reading_progress_events_session_id
	ON reading_progress_events(reading_session_id);

PRAGMA foreign_keys = ON;
`
