/**
 * Public import orchestration API (Phase 10).
 */

import { SqlExecutor } from '@/db/sqlExecutor'
import { buildCandidatesFromCsv } from './buildCandidates'
import { IMPORT_MAX_FILE_BYTES } from './constants'
import { parseCsv, ImportParseError } from './csvParser'
import { detectImportFormat, formatLabel } from './detectFormat'
import {
	analyzeDuplicates,
	applyDuplicatePolicy,
	buildExistingLibraryIndex,
} from './duplicateAnalysis'
import { commitImportCandidates } from './importCommit'
import { autoMapHeaders, mappingHasTitle } from './mapHeaders'
import type {
	DuplicatePolicy,
	HeaderMapping,
	ImportBookCandidate,
	ImportCommitReport,
	ImportFormat,
	ImportPreviewSummary,
	ParsedCsvTable,
} from './types'

export {
	parseCsv,
	ImportParseError,
	detectImportFormat,
	formatLabel,
	autoMapHeaders,
	mappingHasTitle,
	buildCandidatesFromCsv,
	analyzeDuplicates,
	applyDuplicatePolicy,
	commitImportCandidates,
	IMPORT_MAX_FILE_BYTES,
}
export type {
	ImportBookCandidate,
	ImportFormat,
	HeaderMapping,
	DuplicatePolicy,
	ImportCommitReport,
	ImportPreviewSummary,
	ParsedCsvTable,
}

export interface PreparedImport {
	table: ParsedCsvTable
	format: ImportFormat
	formatLabel: string
	mapping: HeaderMapping
	needsManualMapping: boolean
	candidates: ImportBookCandidate[]
	summary: ImportPreviewSummary
}

export function assertImportFileSize (byteLength: number): void {
	if (byteLength > IMPORT_MAX_FILE_BYTES) {
		throw new ImportParseError('Файл слишком большой для импорта.')
	}
}

export function assertImportTextSize (text: string): void {
	// Approximate UTF-8 size without Buffer in RN
	let bytes = 0
	for (let i = 0; i < text.length; i += 1) {
		const code = text.charCodeAt(i)
		bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : 3
		if (bytes > IMPORT_MAX_FILE_BYTES) {
			throw new ImportParseError('Файл слишком большой для импорта.')
		}
	}
}

function summarize (
	format: ImportFormat,
	candidates: ImportBookCandidate[],
): ImportPreviewSummary {
	const valid = candidates.filter((c) => c.valid)
	const duplicates = candidates.filter(
		(c) => c.valid && c.duplicateKind != null,
	)
	const errors = candidates.filter((c) => !c.valid)
	const selected = candidates.filter((c) => c.selected)
	return {
		format,
		formatLabel: formatLabel(format),
		totalRows: candidates.length,
		validCount: valid.length,
		duplicateCount: duplicates.length,
		errorCount: errors.length,
		selectedCount: selected.length,
	}
}

/**
 * Parse text → detect → auto-map → candidates → duplicate analysis.
 */
export async function prepareImportFromCsvText (
	db: SqlExecutor,
	text: string,
	opts: {
		mappingOverride?: HeaderMapping
		duplicatePolicy?: DuplicatePolicy
	} = {},
): Promise<PreparedImport> {
	const table = parseCsv(text)
	const format = detectImportFormat(table.headers)

	const mapping =
		opts.mappingOverride ?? autoMapHeaders(table.headers)
	const needsManualMapping = !mappingHasTitle(mapping)
	// Unknown / unmatched headers → manual mapping UI (title required).
	if (needsManualMapping && !opts.mappingOverride) {
		const resolved: ImportFormat =
			format === 'UNKNOWN' ? 'GENERIC_CSV' : format
		return {
			table,
			format: resolved,
			formatLabel: formatLabel(resolved),
			mapping,
			needsManualMapping: true,
			candidates: [],
			summary: {
				format: resolved,
				formatLabel: formatLabel(resolved),
				totalRows: table.rows.length,
				validCount: 0,
				duplicateCount: 0,
				errorCount: 0,
				selectedCount: 0,
			},
		}
	}

	const built = buildCandidatesFromCsv(table, mapping)
	const index = await buildExistingLibraryIndex(db)
	const policy = opts.duplicatePolicy ?? 'SKIP'
	const candidates = analyzeDuplicates(built, index, policy)

	const resolvedFormat =
		format === 'UNKNOWN' ? 'GENERIC_CSV' : format

	return {
		table,
		format: resolvedFormat,
		formatLabel: formatLabel(resolvedFormat),
		mapping,
		needsManualMapping: false,
		candidates,
		summary: summarize(resolvedFormat, candidates),
	}
}

export async function reanalyzeWithPolicy (
	db: SqlExecutor,
	candidates: ImportBookCandidate[],
	policy: DuplicatePolicy,
): Promise<{
	candidates: ImportBookCandidate[]
	summary: ImportPreviewSummary
}> {
	// Re-run from clean duplicate state using existing annotations rebuild
	const cleared = candidates.map((c) => ({
		...c,
		duplicateKind: null,
		existingEntryId: null,
		existingBookId: null,
		existingTitle: null,
		withinFilePrimaryId: null,
		selected: c.valid,
		policy: 'SKIP' as DuplicatePolicy,
	}))
	const index = await buildExistingLibraryIndex(db)
	const analyzed = analyzeDuplicates(cleared, index, policy)
	const format: ImportFormat = 'GENERIC_CSV'
	return {
		candidates: analyzed,
		summary: summarize(format, analyzed),
	}
}

export function updateCandidateSelection (
	candidates: ImportBookCandidate[],
	id: string,
	selected: boolean,
): ImportBookCandidate[] {
	return candidates.map((c) =>
		c.id === id && c.valid && c.duplicateKind !== 'WITHIN_FILE'
			? { ...c, selected }
			: c,
	)
}

export function setCandidatePolicy (
	candidates: ImportBookCandidate[],
	id: string,
	policy: DuplicatePolicy,
): ImportBookCandidate[] {
	return candidates.map((c) => {
		if (c.id !== id || c.duplicateKind !== 'EXISTING_LIBRARY') {
			return c
		}
		return {
			...c,
			policy,
			selected: policy === 'ADD_EDITION',
		}
	})
}

export async function runImportCommit (
	db: SqlExecutor,
	candidates: ImportBookCandidate[],
): Promise<ImportCommitReport> {
	return commitImportCandidates(db, candidates)
}
