/**
 * Migration 003 — store original remote cover URL separately from display coverUri.
 * coverUri may become a local cached file after download.
 */

export const migration003RemoteCoverUrl = `
PRAGMA foreign_keys = ON;

ALTER TABLE books ADD COLUMN remote_cover_url TEXT;
`
