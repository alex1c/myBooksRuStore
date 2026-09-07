/**
 * Migration 005 — extra indexes for activity / streak / goal range scans.
 * reading_goals already exists (001). Finished-date and ended_at indexes
 * already exist from 002/004 — re-create with IF NOT EXISTS for safety.
 */

export const migration005ActivityIndexes = `
PRAGMA foreign_keys = ON;

CREATE INDEX IF NOT EXISTS idx_reading_progress_events_type_created
	ON reading_progress_events(type, created_at);
`
