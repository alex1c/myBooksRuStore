/**
 * CSV / PDF export screen (Phase 9).
 */

import { useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'

import {
	Card,
	LoadingState,
	PrimaryButton,
	Screen,
	SectionHeader,
} from '@/components/ui'
import { exportCopy } from '@/constants/copy'
import { colors, radii, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import {
	exportAndShareLibraryCsv,
	exportAndShareLibraryPdf,
	type PdfLibraryFilter,
} from '@/domain/export/exportService'

const PDF_FILTERS: { key: PdfLibraryFilter; label: string }[] = [
	{ key: 'ALL', label: exportCopy.filterAll },
	{ key: 'FINISHED', label: exportCopy.filterFinished },
	{ key: 'READING', label: exportCopy.filterReading },
	{ key: 'WANT_TO_READ', label: exportCopy.filterWant },
]

export default function ExportScreen () {
	const { executor } = useDatabase()
	const [busy, setBusy] = useState<'csv' | 'pdf' | null>(null)
	const [pdfFilter, setPdfFilter] = useState<PdfLibraryFilter>('ALL')

	const handleCsv = async () => {
		if (busy) {
			return
		}
		setBusy('csv')
		try {
			await exportAndShareLibraryCsv(executor)
			Alert.alert(exportCopy.csvReady)
		} catch {
			Alert.alert(exportCopy.errorTitle, exportCopy.csvFailed)
		} finally {
			setBusy(null)
		}
	}

	const handlePdf = async () => {
		if (busy) {
			return
		}
		setBusy('pdf')
		try {
			await exportAndShareLibraryPdf(executor, pdfFilter)
			Alert.alert(exportCopy.pdfReady)
		} catch {
			Alert.alert(exportCopy.errorTitle, exportCopy.pdfFailed)
		} finally {
			setBusy(null)
		}
	}

	return (
		<Screen scroll contentStyle={styles.content}>
			<SectionHeader
				title={exportCopy.title}
				subtitle={exportCopy.subtitle}
			/>
			<Text style={styles.privacy}>{exportCopy.privacy}</Text>

			{busy ? (
				<LoadingState
					message={
						busy === 'csv' ? exportCopy.creatingCsv : exportCopy.creatingPdf
					}
				/>
			) : (
				<>
					<Card style={styles.card}>
						<Text style={styles.section}>{exportCopy.csvTitle}</Text>
						<Text style={styles.hint}>{exportCopy.csvHint}</Text>
						<PrimaryButton
							label={exportCopy.csvAction}
							onPress={() => {
								void handleCsv()
							}}
						/>
					</Card>

					<Card style={styles.card}>
						<Text style={styles.section}>{exportCopy.pdfTitle}</Text>
						<Text style={styles.hint}>{exportCopy.pdfHint}</Text>
						<View style={styles.filters}>
							{PDF_FILTERS.map((f) => {
								const active = pdfFilter === f.key
								return (
									<Pressable
										key={f.key}
										onPress={() => setPdfFilter(f.key)}
										style={[
											styles.chip,
											active && styles.chipActive,
										]}
									>
										<Text
											style={[
												styles.chipText,
												active && styles.chipTextActive,
											]}
										>
											{f.label}
										</Text>
									</Pressable>
								)
							})}
						</View>
						<PrimaryButton
							label={exportCopy.pdfAction}
							onPress={() => {
								void handlePdf()
							}}
						/>
					</Card>
				</>
			)}
		</Screen>
	)
}

const styles = StyleSheet.create({
	content: {
		gap: spacing.md,
		paddingBottom: spacing.xxl,
	},
	privacy: {
		...typography.bodySmall,
		color: colors.muted,
	},
	card: {
		gap: spacing.sm,
	},
	section: {
		...typography.section,
		color: colors.text,
	},
	hint: {
		...typography.bodySmall,
		color: colors.textSecondary,
	},
	filters: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.xs,
	},
	chip: {
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
		borderRadius: radii.full,
		backgroundColor: colors.surfaceMuted,
	},
	chipActive: {
		backgroundColor: colors.primarySoft,
	},
	chipText: {
		...typography.bodySmall,
		color: colors.textSecondary,
		fontWeight: '600',
	},
	chipTextActive: {
		color: colors.primaryDark,
	},
})
