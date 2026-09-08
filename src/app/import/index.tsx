/**
 * Mass library import flow (Phase 10).
 * Steps: pick → mapping? → preview → report
 */

import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { router } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import {
	ActivityIndicator,
	Alert,
	FlatList,
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native'

import {
	Card,
	PrimaryButton,
	Screen,
	SecondaryButton,
	SectionHeader,
} from '@/components/ui'
import { importCopy } from '@/constants/copy'
import { statusLabels } from '@/constants/labels'
import { colors, radii, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import {
	applyDuplicatePolicy,
	assertImportFileSize,
	assertImportTextSize,
	ImportParseError,
	prepareImportFromCsvText,
	runImportCommit,
	setCandidatePolicy,
	updateCandidateSelection,
	type DuplicatePolicy,
	type HeaderMapping,
	type ImportBookCandidate,
	type ImportCommitReport,
	type ImportFormat,
	type ParsedCsvTable,
} from '@/domain/import/importService'
import { FIELD_LABELS_RU } from '@/domain/import/mapHeaders'
import type { FieldKey } from '@/domain/import/types'

type Step = 'home' | 'mapping' | 'preview' | 'report'
type PreviewFilter = 'ALL' | 'READY' | 'DUPES' | 'ERRORS'

export default function ImportScreen () {
	const { executor } = useDatabase()
	const [step, setStep] = useState<Step>('home')
	const [busy, setBusy] = useState(false)
	const [busyLabel, setBusyLabel] = useState('')
	const [table, setTable] = useState<ParsedCsvTable | null>(null)
	const [csvText, setCsvText] = useState('')
	const [formatLabel, setFormatLabel] = useState('')
	const [importFormat, setImportFormat] = useState<ImportFormat>('GENERIC_CSV')
	const [mapping, setMapping] = useState<HeaderMapping>({})
	const [candidates, setCandidates] = useState<ImportBookCandidate[]>([])
	const [policy, setPolicy] = useState<DuplicatePolicy>('SKIP')
	const [filter, setFilter] = useState<PreviewFilter>('ALL')
	const [report, setReport] = useState<ImportCommitReport | null>(null)
	const [summary, setSummary] = useState({
		totalRows: 0,
		validCount: 0,
		duplicateCount: 0,
		errorCount: 0,
		selectedCount: 0,
	})

	const refreshSummary = useCallback((list: ImportBookCandidate[]) => {
		setSummary({
			totalRows: list.length,
			validCount: list.filter((c) => c.valid).length,
			duplicateCount: list.filter(
				(c) => c.valid && c.duplicateKind != null,
			).length,
			errorCount: list.filter((c) => !c.valid).length,
			selectedCount: list.filter((c) => c.selected).length,
		})
	}, [])

	const handlePick = async () => {
		try {
			const picked = await DocumentPicker.getDocumentAsync({
				type: [
					'text/csv',
					'text/comma-separated-values',
					'text/plain',
					'application/csv',
					'*/*',
				],
				copyToCacheDirectory: true,
				multiple: false,
			})
			if (picked.canceled || !picked.assets?.[0]) {
				return
			}
			const asset = picked.assets[0]
			setBusy(true)
			setBusyLabel(importCopy.parsing)
			assertImportFileSize(asset.size ?? 0)
			const text = await FileSystem.readAsStringAsync(asset.uri, {
				encoding: FileSystem.EncodingType.UTF8,
			})
			assertImportTextSize(text)
			const prepared = await prepareImportFromCsvText(executor, text)
			setCsvText(text)
			setTable(prepared.table)
			setFormatLabel(prepared.formatLabel)
			setImportFormat(prepared.format)
			setMapping(prepared.mapping)
			if (prepared.needsManualMapping) {
				setStep('mapping')
			} else {
				setCandidates(prepared.candidates)
				refreshSummary(prepared.candidates)
				setStep('preview')
			}
		} catch (error) {
			const message =
				error instanceof ImportParseError
					? error.message
					: importCopy.parseFailed
			Alert.alert(importCopy.errorTitle, message)
		} finally {
			setBusy(false)
		}
	}

	const handleApplyMapping = async () => {
		if (!table || !mapping.title) {
			Alert.alert(importCopy.errorTitle, importCopy.titleMappingRequired)
			return
		}
		setBusy(true)
		setBusyLabel(importCopy.parsing)
		try {
			const prepared = await prepareImportFromCsvText(executor, csvText, {
				mappingOverride: mapping,
				duplicatePolicy: policy,
			})
			setCandidates(prepared.candidates)
			setFormatLabel(prepared.formatLabel)
			setImportFormat(prepared.format)
			refreshSummary(prepared.candidates)
			setStep('preview')
		} catch (error) {
			const message =
				error instanceof ImportParseError
					? error.message
					: importCopy.parseFailed
			Alert.alert(importCopy.errorTitle, message)
		} finally {
			setBusy(false)
		}
	}

	const handlePolicyChange = (next: DuplicatePolicy) => {
		setPolicy(next)
		const updated = applyDuplicatePolicy(candidates, next)
		setCandidates(updated)
		refreshSummary(updated)
	}

	const handleCommit = async () => {
		if (summary.selectedCount === 0) {
			Alert.alert(importCopy.errorTitle, importCopy.nothingSelected)
			return
		}
		setBusy(true)
		setBusyLabel(importCopy.importing)
		try {
			const result = await runImportCommit(executor, candidates, {
				format: importFormat,
			})
			setReport(result)
			setStep('report')
		} catch {
			Alert.alert(importCopy.errorTitle, importCopy.importFailed)
		} finally {
			setBusy(false)
		}
	}

	const filtered = useMemo(() => {
		switch (filter) {
			case 'READY':
				return candidates.filter(
					(c) => c.valid && c.duplicateKind == null,
				)
			case 'DUPES':
				return candidates.filter(
					(c) => c.valid && c.duplicateKind != null,
				)
			case 'ERRORS':
				return candidates.filter((c) => !c.valid)
			default:
				return candidates
		}
	}, [candidates, filter])

	if (busy) {
		return (
			<Screen contentStyle={styles.center}>
				<ActivityIndicator color={colors.primary} size="large" />
				<Text style={styles.busy}>{busyLabel}</Text>
			</Screen>
		)
	}

	if (step === 'report' && report) {
		return (
			<Screen scroll contentStyle={styles.content}>
				<SectionHeader title={importCopy.reportTitle} />
				<Card style={styles.card}>
					<Text style={styles.body}>
						{importCopy.reportAdded(report.added)}
					</Text>
					<Text style={styles.body}>
						{importCopy.reportSkipped(report.skippedDuplicates)}
					</Text>
					<Text style={styles.body}>
						{importCopy.reportErrors(report.errorRows)}
					</Text>
					<Text style={styles.body}>
						{importCopy.reportShelves(report.shelvesCreated)}
					</Text>
				</Card>
				<PrimaryButton
					label={importCopy.openLibrary}
					onPress={() => router.replace('/(tabs)/library')}
				/>
				<SecondaryButton
					label={importCopy.done}
					onPress={() => router.back()}
				/>
			</Screen>
		)
	}

	if (step === 'mapping' && table) {
		return (
			<Screen scroll contentStyle={styles.content}>
				<SectionHeader
					title={importCopy.mappingTitle}
					subtitle={importCopy.mappingHint}
				/>
				{(Object.keys(FIELD_LABELS_RU) as FieldKey[])
					.filter((k) =>
						[
							'title',
							'author',
							'status',
							'format',
							'isbn13',
							'isbn10',
							'rating',
							'finishedDate',
							'totalVolume',
							'shelves',
						].includes(k),
					)
					.map((field) => (
						<View key={field} style={styles.mapRow}>
							<Text style={styles.mapLabel}>
								{FIELD_LABELS_RU[field]}
								{field === 'title' ? ' *' : ''}
							</Text>
							<HeaderPicker
								headers={table.headers}
								value={mapping[field] ?? ''}
								onChange={(header) =>
									setMapping((m) => ({
										...m,
										[field]: header || undefined,
									}))
								}
							/>
						</View>
					))}
				<Text style={styles.hint}>{importCopy.sampleHint}</Text>
				{table.rows.slice(0, 3).map((row, idx) => (
					<Text key={idx} style={styles.sample} numberOfLines={2}>
						{row.slice(0, 3).join(' · ')}
					</Text>
				))}
				<PrimaryButton
					label={importCopy.continuePreview}
					onPress={() => {
						void handleApplyMapping()
					}}
				/>
			</Screen>
		)
	}

	if (step === 'preview') {
		return (
			<View style={styles.flex}>
				<Screen contentStyle={styles.previewHeader}>
					<SectionHeader
						title={importCopy.previewTitle}
						subtitle={formatLabel}
					/>
					<Text style={styles.privacy}>{importCopy.privacy}</Text>
					<Card style={styles.card}>
						<Text style={styles.body}>
							{importCopy.found(summary.totalRows)}
						</Text>
						<Text style={styles.body}>
							{importCopy.ready(summary.validCount - summary.duplicateCount)}
						</Text>
						<Text style={styles.body}>
							{importCopy.duplicates(summary.duplicateCount)}
						</Text>
						<Text style={styles.body}>
							{importCopy.errors(summary.errorCount)}
						</Text>
						<Text style={styles.hint}>
							{importCopy.selected(summary.selectedCount)}
						</Text>
					</Card>

					<Text style={styles.section}>{importCopy.duplicatePolicy}</Text>
					<View style={styles.row}>
						{(
							[
								['SKIP', importCopy.policySkip],
								['ADD_EDITION', importCopy.policyAdd],
							] as const
						).map(([key, label]) => (
							<Pressable
								key={key}
								onPress={() => handlePolicyChange(key)}
								style={[
									styles.chip,
									policy === key && styles.chipActive,
								]}
							>
								<Text
									style={[
										styles.chipText,
										policy === key && styles.chipTextActive,
									]}
								>
									{label}
								</Text>
							</Pressable>
						))}
					</View>

					<View style={styles.row}>
						{(
							[
								['ALL', importCopy.filterAll],
								['READY', importCopy.filterReady],
								['DUPES', importCopy.filterDupes],
								['ERRORS', importCopy.filterErrors],
							] as const
						).map(([key, label]) => (
							<Pressable
								key={key}
								onPress={() => setFilter(key)}
								style={[
									styles.chip,
									filter === key && styles.chipActive,
								]}
							>
								<Text
									style={[
										styles.chipText,
										filter === key && styles.chipTextActive,
									]}
								>
									{label}
								</Text>
							</Pressable>
						))}
					</View>
				</Screen>

				<FlatList
					data={filtered}
					keyExtractor={(item) => item.id}
					contentContainerStyle={styles.list}
					renderItem={({ item }) => (
						<CandidateRow
							item={item}
							onToggle={() => {
								const next = updateCandidateSelection(
									candidates,
									item.id,
									!item.selected,
								)
								setCandidates(next)
								refreshSummary(next)
							}}
							onPolicy={(p) => {
								const next = setCandidatePolicy(
									candidates,
									item.id,
									p,
								)
								setCandidates(next)
								refreshSummary(next)
							}}
						/>
					)}
				/>

				<View style={styles.footer}>
					<PrimaryButton
						label={importCopy.commit}
						onPress={() => {
							void handleCommit()
						}}
					/>
					<SecondaryButton
						label={importCopy.cancel}
						onPress={() => {
							setStep('home')
							setCandidates([])
						}}
					/>
				</View>
			</View>
		)
	}

	return (
		<Screen scroll contentStyle={styles.content}>
			<SectionHeader
				title={importCopy.title}
				subtitle={importCopy.subtitle}
			/>
			<Text style={styles.privacy}>{importCopy.privacy}</Text>
			<Card style={styles.card}>
				<Text style={styles.body}>{importCopy.supportsOur}</Text>
				<Text style={styles.body}>{importCopy.supportsGoodreads}</Text>
				<Text style={styles.body}>{importCopy.supportsGeneric}</Text>
				<Text style={styles.hint}>{importCopy.notBackup}</Text>
			</Card>
			<PrimaryButton
				label={importCopy.pickCsv}
				onPress={() => {
					void handlePick()
				}}
			/>
		</Screen>
	)
}

function HeaderPicker ({
	headers,
	value,
	onChange,
}: {
	headers: string[]
	value: string
	onChange: (v: string) => void
}) {
	return (
		<View style={styles.headerPick}>
			<Pressable
				onPress={() => onChange('')}
				style={[styles.chip, !value && styles.chipActive]}
			>
				<Text style={styles.chipText}>—</Text>
			</Pressable>
			{headers.map((h) => (
				<Pressable
					key={h}
					onPress={() => onChange(h)}
					style={[styles.chip, value === h && styles.chipActive]}
				>
					<Text
						style={[
							styles.chipText,
							value === h && styles.chipTextActive,
						]}
						numberOfLines={1}
					>
						{h}
					</Text>
				</Pressable>
			))}
		</View>
	)
}

function CandidateRow ({
	item,
	onToggle,
	onPolicy,
}: {
	item: ImportBookCandidate
	onToggle: () => void
	onPolicy: (p: DuplicatePolicy) => void
}) {
	const badge = !item.valid
		? importCopy.badgeError
		: item.duplicateKind
			? importCopy.badgeDupe
			: importCopy.badgeOk

	return (
		<Card style={styles.candidate}>
			<Pressable
				onPress={onToggle}
				disabled={!item.valid || item.duplicateKind === 'WITHIN_FILE'}
			>
				<Text style={styles.candidateTitle} numberOfLines={2}>
					{item.selected ? '☑ ' : '☐ '}
					{item.title || '—'}
				</Text>
			</Pressable>
			<Text style={styles.muted} numberOfLines={1}>
				{item.authorText || '—'}
			</Text>
			<Text style={styles.body}>
				{statusLabels[item.status]} · {badge}
			</Text>
			{item.warnings[0] ? (
				<Text style={styles.warn}>{item.warnings[0]}</Text>
			) : null}
			{item.errors[0] ? (
				<Text style={styles.err}>{item.errors[0]}</Text>
			) : null}
			{item.duplicateKind === 'EXISTING_LIBRARY' ? (
				<View style={styles.row}>
					<Pressable
						onPress={() => onPolicy('SKIP')}
						style={[
							styles.chip,
							item.policy === 'SKIP' && styles.chipActive,
						]}
					>
						<Text style={styles.chipText}>
							{importCopy.policySkip}
						</Text>
					</Pressable>
					<Pressable
						onPress={() => onPolicy('ADD_EDITION')}
						style={[
							styles.chip,
							item.policy === 'ADD_EDITION' && styles.chipActive,
						]}
					>
						<Text style={styles.chipText}>
							{importCopy.policyAdd}
						</Text>
					</Pressable>
				</View>
			) : null}
			{item.existingTitle ? (
				<Text style={styles.hint}>
					{importCopy.alreadyInLibrary(item.existingTitle)}
				</Text>
			) : null}
		</Card>
	)
}

const styles = StyleSheet.create({
	flex: { flex: 1, backgroundColor: colors.background },
	content: { gap: spacing.md, paddingBottom: spacing.xxl },
	center: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		gap: spacing.md,
	},
	busy: { ...typography.body, color: colors.textSecondary },
	privacy: { ...typography.bodySmall, color: colors.muted },
	card: { gap: spacing.xs },
	body: { ...typography.body, color: colors.text },
	hint: { ...typography.bodySmall, color: colors.muted },
	section: { ...typography.section, color: colors.text },
	row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
	chip: {
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
		borderRadius: radii.full,
		backgroundColor: colors.surfaceMuted,
	},
	chipActive: { backgroundColor: colors.primarySoft },
	chipText: {
		...typography.caption,
		color: colors.textSecondary,
		fontWeight: '600',
	},
	chipTextActive: { color: colors.primaryDark },
	previewHeader: { gap: spacing.sm, paddingBottom: spacing.sm },
	list: { paddingHorizontal: spacing.md, paddingBottom: 120, gap: spacing.sm },
	footer: {
		padding: spacing.md,
		gap: spacing.sm,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.border,
		backgroundColor: colors.background,
	},
	candidate: { gap: 4, marginBottom: spacing.sm },
	candidateTitle: {
		...typography.body,
		fontWeight: '700',
		color: colors.text,
	},
	muted: { ...typography.bodySmall, color: colors.textSecondary },
	warn: { ...typography.caption, color: colors.warning },
	err: { ...typography.caption, color: colors.danger },
	mapRow: { gap: spacing.xs },
	mapLabel: { ...typography.bodySmall, fontWeight: '700', color: colors.text },
	headerPick: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
	sample: { ...typography.caption, color: colors.muted },
})
