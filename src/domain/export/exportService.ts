/**
 * User-facing export helpers (CSV / PDF share pipelines).
 */

import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'

import { SqlExecutor } from '@/db/sqlExecutor'
import {
	writeTempBinaryFile,
	writeTempTextFile,
} from '@/domain/backup/fileAdapters'
import {
	buildLibraryCsv,
	libraryCsvFileName,
} from './csvExport'
import {
	buildLibraryPdfHtml,
	libraryPdfFileName,
	type PdfLibraryFilter,
} from './pdfExport'

export async function exportAndShareLibraryCsv (
	db: SqlExecutor,
): Promise<{ uri: string; fileName: string }> {
	const csv = await buildLibraryCsv(db)
	const fileName = libraryCsvFileName()
	const uri = await writeTempTextFile(fileName, csv)
	if (await Sharing.isAvailableAsync()) {
		await Sharing.shareAsync(uri, {
			mimeType: 'text/csv',
			dialogTitle: 'Экспорт библиотеки CSV',
			UTI: 'public.comma-separated-values-text',
		})
	}
	return { uri, fileName }
}

export async function exportAndShareLibraryPdf (
	db: SqlExecutor,
	filter: PdfLibraryFilter = 'ALL',
): Promise<{ uri: string; fileName: string }> {
	const html = await buildLibraryPdfHtml(db, filter)
	const fileName = libraryPdfFileName()
	const result = await Print.printToFileAsync({ html })
	// Copy/rename into our exports cache with a stable name when possible.
	let uri = result.uri
	try {
		const FileSystem = await import('expo-file-system/legacy')
		const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory
		if (base) {
			const dir = `${base}exports`
			const info = await FileSystem.getInfoAsync(dir)
			if (!info.exists) {
				await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
			}
			const target = `${dir}/${fileName}`
			await FileSystem.copyAsync({ from: result.uri, to: target })
			uri = target
		}
	} catch {
		uri = result.uri
	}

	if (await Sharing.isAvailableAsync()) {
		await Sharing.shareAsync(uri, {
			mimeType: 'application/pdf',
			dialogTitle: 'Моя библиотека PDF',
		})
	}
	return { uri, fileName }
}

export { buildLibraryCsv, buildLibraryPdfHtml, writeTempBinaryFile }
export type { PdfLibraryFilter }
