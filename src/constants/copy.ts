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
	startReading: 'Начать чтение',
	continueSession: 'Продолжить чтение',
	activeSessionBanner: 'Незавершённая сессия',
	setExact: 'Указать',
	progressUpdated: 'Прогресс обновлён',
	undo: 'Отменить',
	plus1: '+1',
	plus10: '+10',
	plus25: '+25',
	plus1pct: '+1%',
	plus5pct: '+5%',
	plus10pct: '+10%',
	plus10min: '+10 мин',
	plus30min: '+30 мин',
	plus60min: '+60 мин',
} as const

export const sessionCopy = {
	title: 'Читаем',
	finish: 'Завершить',
	cancelSession: 'Отменить сессию',
	cancelConfirmTitle: 'Отменить сессию?',
	cancelConfirmMessage:
		'Сессия будет удалена. Прогресс книги не изменится.',
	cancelConfirmAction: 'Удалить сессию',
	startedFromPages: (page: number) => `Начали со стр. ${page}`,
	startedFromPercent: (percent: number) =>
		`Начали с ${Math.round(percent)}%`,
	startedFromTime: (label: string) => `Начали с ${label}`,
	longSessionWarning:
		'Сессия длится уже более 12 ч. Проверьте, не забыли ли вы её завершить.',
	conflictTitle: 'Уже идёт чтение',
	conflictMessage: (title: string) =>
		`У вас уже идёт чтение «${title}».`,
	returnToSession: 'Вернуться к сессии',
	finishExisting: 'Завершить её',
	finishTitle: 'Итог сессии',
	save: 'Сохранить',
	discard: 'Не сохранять',
	was: 'Было',
	now: 'Сейчас',
	durationLabel: (label: string) => `${label} чтения`,
	historyTitle: 'История чтения',
	historyEmpty: 'Сессий пока нет',
	historyAll: 'Вся история',
	deleteSession: 'Удалить запись',
	deleteSessionHint:
		'Удалит только запись сессии. Текущий прогресс книги не пересчитается.',
	completionTitle: 'Книга закончена',
	completionMessage: 'Отметить как прочитанную?',
	completionLater: 'Позже',
	completionDone: 'Прочитано',
	rateOptional: 'Оценить книгу',
	markFinished: 'Отметить прочитанной',
	continueReading: 'Продолжить чтение',
	returnToBook: 'Вернуться к книге',
	reopenReading: 'Читать снова',
	exactTitle: 'Указать прогресс',
	pageLabel: 'Текущая страница',
	percentLabel: 'Процент',
	hoursLabel: 'Часы',
	minutesLabel: 'Минуты',
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

export const searchCopy = {
	hubTitle: 'Добавить книгу',
	hubSearchTitle: 'Найти книгу',
	hubSearchHint: 'Быстрый поиск по каталогу — название, автор или ISBN',
	hubManualTitle: 'Добавить вручную',
	hubManualHint: 'Работает без интернета',
	hubScanTitle: 'Сканировать штрихкод',
	hubScanHint: 'ISBN с обложки книги',
	title: 'Поиск книг',
	placeholder: 'Название, автор или ISBN',
	initialTitle: 'Найдите книгу по названию, автору или ISBN.',
	initialHint: 'Можно также отсканировать штрихкод или добавить книгу вручную.',
	loading: 'Ищем книги…',
	emptyTitle: 'Ничего не нашли',
	emptyHint: 'Попробуйте изменить запрос или добавьте книгу вручную.',
	changeQuery: 'Изменить запрос',
	manualAdd: 'Добавить вручную',
	networkErrorTitle: 'Не удалось выполнить поиск',
	networkErrorHint: 'Проверьте подключение к интернету.',
	retry: 'Повторить',
	add: 'Добавить',
	searchAction: 'Найти',
	previewTitle: 'Добавить в библиотеку',
	previewEdit: 'Изменить данные',
	previewSubmit: 'Добавить в библиотеку',
	addedToast: 'Книга добавлена в библиотеку',
	duplicateTitle: 'Эта книга уже есть в библиотеке',
	duplicateOpen: 'Открыть',
	duplicateAddEdition: 'Добавить другое издание',
	attribution: 'Метаданные: Open Library',
} as const

export const scanCopy = {
	title: 'Сканер ISBN',
	permissionExplain:
		'Камера нужна только для сканирования штрихкода книги.',
	permissionAllow: 'Разрешить камеру',
	permissionDeniedTitle: 'Разрешение на камеру не предоставлено',
	permissionDeniedHint: 'Можно ввести ISBN вручную или повторить запрос.',
	tryAgain: 'Попробовать снова',
	enterIsbn: 'Ввести ISBN вручную',
	lookingUp: 'Ищем книгу по ISBN…',
	notBookland: 'Этот штрихкод не похож на ISBN книги.',
	notFound: 'Книга с таким ISBN не найдена',
	manualFallback: 'Добавить вручную',
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
	history: 'История чтения',
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
