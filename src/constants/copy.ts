/**
 * Russian UI copy for screens and bootstrap states.
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
	save: 'Сохранить',
	cancel: 'Отмена',
	edit: 'Изменить',
	delete: 'Удалить',
	archive: 'Архивировать',
	restore: 'Восстановить',
	authorUnknown: 'Автор не указан',
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
	emptyTitle: 'Сейчас ничего не читаете',
	emptyDescription:
		'Выберите книгу из библиотеки или добавьте новую — она появится здесь.',
	chooseFromLibrary: 'Выбрать из библиотеки',
	addBook: 'Добавить книгу',
	readingSection: 'Читаю сейчас',
} as const

export const libraryCopy = {
	title: 'Библиотека',
	emptyTitle: 'Ваша библиотека пока пуста',
	emptyDescription: 'Добавьте первую книгу — это займёт меньше минуты.',
	addBook: 'Добавить книгу',
	addBookShort: '+ Добавить',
	searchPlaceholder: 'Поиск по книгам и авторам',
	filterEmpty: (statusLabel: string) =>
		`В разделе «${statusLabel}» пока нет книг.`,
	sort: 'Сортировка',
	shelves: 'Полки',
	countsReading: 'Читаю',
	countsWant: 'Хочу',
	countsFinished: 'Прочитано',
} as const

export const addBookCopy = {
	title: 'Добавить книгу',
	editTitle: 'Изменить книгу',
	titleLabel: 'Название',
	titlePlaceholder: 'Название книги',
	authorLabel: 'Автор',
	authorPlaceholder: 'Имя автора (необязательно)',
	moreDetails: 'Дополнительные сведения',
	subtitleLabel: 'Подзаголовок',
	isbn10Label: 'ISBN-10',
	isbn13Label: 'ISBN-13',
	publisherLabel: 'Издательство',
	yearLabel: 'Год издания',
	pageCountLabel: 'Страниц в книге',
	descriptionLabel: 'Описание',
	formatLabel: 'Формат',
	statusLabel: 'Статус',
	progressModeLabel: 'Как отмечать прогресс',
	currentPageLabel: 'Текущая страница',
	totalPagesLabel: 'Всего страниц',
	percentLabel: 'Прогресс, %',
	audioPositionLabel: 'Текущая позиция',
	audioDurationLabel: 'Длительность',
	hoursLabel: 'ч',
	minutesLabel: 'мин',
	ratingLabel: 'Оценка',
	reviewLabel: 'Мой отзыв',
	reviewPlaceholder: 'Личные впечатления (необязательно)',
	finishedWhenLabel: 'Когда прочитали?',
	finishedToday: 'Сегодня',
	finishedThisYear: 'В этом году',
	finishedEarlier: 'Раньше',
	finishedPickDate: 'Указать дату',
	finishedYearLabel: 'Год прочтения',
	finishedDateLabel: 'Дата прочтения',
	shelvesLabel: 'Полки',
	submitAdd: 'Добавить',
	submitSave: 'Сохранить',
	duplicateTitle: 'Похожая книга уже есть в библиотеке',
	duplicateOpen: 'Открыть существующую',
	duplicateAddAnyway: 'Всё равно добавить',
	useBookPageCount: 'Использовать число страниц из книги',
} as const

export const bookDetailsCopy = {
	progress: 'Прогресс',
	metadata: 'Сведения',
	personal: 'Мои данные',
	shelves: 'Полки',
	archiveTitle: 'Архивировать книгу?',
	archiveMessage:
		'Книга исчезнет из активной библиотеки, но история чтения сохранится.',
	archiveConfirm: 'Архивировать',
	finished: 'Прочитано',
	noProgress: 'Прогресс не указан',
	noRating: 'Без оценки',
} as const

export const archiveCopy = {
	title: 'Архив книг',
	emptyTitle: 'Архив пуст',
	emptyDescription: 'Архивированные книги появятся здесь.',
	restored: 'Книга возвращена в библиотеку',
} as const

export const shelvesCopy = {
	title: 'Полки',
	emptyTitle: 'Полок пока нет',
	emptyDescription: 'Создайте полку — например «Любимые» или «Классика».',
	create: 'Создать полку',
	rename: 'Переименовать',
	archive: 'Архивировать полку',
	nameLabel: 'Название полки',
	namePlaceholder: 'Например, Любимые',
	archiveConfirmTitle: 'Архивировать полку?',
	archiveConfirmMessage:
		'Книги останутся в библиотеке, связь с полкой будет снята из активных списков.',
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
	archive: 'Архив книг',
	archiveHint: 'Восстановление архивированных книг',
	shelves: 'Полки',
	shelvesHint: 'Коллекции вроде «Любимые» или «Классика»',
	about: 'О приложении',
	aboutHint: 'Дневник чтения · версия 1.0.0',
	aboutBody:
		'Личный offline-first дневник чтения. Основные действия доступны без регистрации и без интернета.',
} as const

export const validationCopy = {
	titleRequired: 'Укажите название книги',
	invalidYear: 'Год издания должен быть от 1000 до текущего + 1',
	invalidIsbn10: 'Проверьте ISBN-10',
	invalidIsbn13: 'Проверьте ISBN-13',
	invalidPage: 'Страница должна быть целым числом от 0',
	invalidTotalPages: 'Всего страниц должно быть больше 0',
	pageExceedsTotal: 'Текущая страница не может быть больше общего числа',
	invalidPercent: 'Процент должен быть от 0 до 100',
	invalidAudio: 'Время не может быть отрицательным',
	audioPositionExceeds: 'Позиция не может превышать длительность',
	invalidRating: 'Оценка от 0 до 5 с шагом 0.5',
	invalidStatus: 'Некорректный статус',
	invalidFormat: 'Некорректный формат',
	invalidProgressMode: 'Некорректный режим прогресса',
	invalidFinishedDate: 'Укажите корректную дату прочтения',
	invalidFinishedYear: 'Укажите корректный год прочтения',
	shelfNameRequired: 'Укажите название полки',
} as const
