/**
 * Maps help catalogue section ids → analytics help_opened section enum.
 */

import type { HelpSectionParam } from '@/domain/analytics/types'

const HELP_SECTION_ANALYTICS: Record<string, HelpSectionParam> = {
	'quick-start': 'quick_start',
	library: 'library',
	progress: 'reading',
	timer: 'timer',
	notes: 'notes',
	diary: 'diary',
	goals: 'goals',
	stats: 'statistics',
	year: 'year',
	backup: 'backup',
	import: 'import',
	ocr: 'ocr',
	reminders: 'reminders',
}

export function mapHelpSectionToAnalytics (
	sectionId: string,
): HelpSectionParam | null {
	return HELP_SECTION_ANALYTICS[sectionId] ?? null
}
