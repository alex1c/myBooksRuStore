/**
 * Russian UI copy for Phase 1 placeholder screens and bootstrap states.
 * Keep user-facing strings here instead of scattering literals in screens.
 */

export const appCopy = {
	name: 'Дневник чтения',
	loading: 'Загрузка…',
	bootstrapErrorTitle: 'Не удалось открыть дневник',
	bootstrapErrorMessage:
		'Локальная база данных не инициализировалась. Попробуйте ещё раз.',
	retry: 'Повторить',
	comingSoonTitle: 'Скоро',
	comingSoonMessage: 'Эта функция появится в следующих обновлениях.',
} as const

export const tabsCopy = {
	today: { title: 'Сегодня' },
	library: { title: 'Библиотека' },
	diary: { title: 'Дневник' },
	stats: { title: 'Статистика' },
	more: { title: 'Ещё' },
} as const

export const todayCopy = {
	title: 'Сегодня',
	emptyTitle: 'Что читаем сегодня?',
	emptyDescription:
		'Добавьте первую книгу — здесь появится текущий прогресс и быстрый старт чтения.',
	goToLibrary: 'Перейти в библиотеку',
} as const

export const libraryCopy = {
	title: 'Библиотека',
	emptyTitle: 'Ваша библиотека пока пуста',
	emptyDescription:
		'Здесь будут ваши книги, статусы чтения и прогресс.',
	addBook: 'Добавить книгу',
	addBookHint:
		'Добавление книг появится в следующей фазе. Данные пока не сохраняются.',
} as const

export const diaryCopy = {
	title: 'Дневник',
	emptyTitle: 'Дневник чтения',
	emptyDescription:
		'Здесь появится история чтения, цитаты и заметки.',
} as const

export const statsCopy = {
	title: 'Статистика',
	emptyTitle: 'Статистика пока пуста',
	emptyDescription:
		'Статистика появится после первых сессий чтения.',
	placeholderBooks: 'Книги',
	placeholderPages: 'Страницы',
	placeholderTime: 'Время',
	placeholderDays: 'Дни чтения',
	placeholderValue: '—',
} as const

export const moreCopy = {
	title: 'Ещё',
	subtitle: 'Настройки и сведения о приложении',
	backup: 'Резервная копия',
	backupHint: 'Экспорт и восстановление появятся позже',
	reminders: 'Напоминания',
	remindersHint: 'Настройка ежедневных напоминаний появится позже',
	about: 'О приложении',
	aboutHint: 'Дневник чтения · версия 1.0.0',
	aboutBody:
		'Личный offline-first дневник чтения. Основные действия доступны без регистрации и без интернета.',
} as const
