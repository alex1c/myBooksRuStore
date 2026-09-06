/**
 * Migration 002 — finished-date precision for library entries.
 *
 * Distinguishes exact finish dates from year-only and unknown finishes
 * so future statistics never treat “Прочитано раньше” as finished today.
 */

export const migration002FinishedDatePrecision = `
PRAGMA foreign_keys = ON;

ALTER TABLE library_entries ADD COLUMN finished_date_precision TEXT;
ALTER TABLE library_entries ADD COLUMN finished_year INTEGER;
ALTER TABLE library_entries ADD COLUMN finished_on TEXT;

CREATE INDEX IF NOT EXISTS idx_library_entries_finished_on
	ON library_entries(finished_on);
CREATE INDEX IF NOT EXISTS idx_library_entries_finished_year
	ON library_entries(finished_year);
`
