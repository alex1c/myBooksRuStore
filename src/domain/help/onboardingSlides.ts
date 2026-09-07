/**
 * First-launch onboarding slides (max 4). Illustrations are UI mocks only.
 */

export interface OnboardingSlide {
	id: string
	title: string
	body: string
	note?: string
	illustration: 'library' | 'today' | 'notes' | 'progress'
	primaryLabel: 'next' | 'start'
}

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
	{
		id: 'library',
		title: 'Ваша библиотека',
		body: 'Добавляйте бумажные, электронные и аудиокниги. Книгу можно найти по названию или ISBN либо добавить вручную.',
		illustration: 'library',
		primaryLabel: 'next',
	},
	{
		id: 'today',
		title: 'Отмечайте чтение за пару касаний',
		body: 'На экране «Сегодня» можно быстро добавить страницы, проценты или время — либо запустить таймер чтения.',
		illustration: 'today',
		primaryLabel: 'next',
	},
	{
		id: 'notes',
		title: 'Сохраняйте то, что важно',
		body: 'Добавляйте цитаты, мысли и заметки. Цитату из бумажной книги можно распознать камерой.',
		note: 'При первом использовании распознавания может потребоваться интернет для загрузки модели.',
		illustration: 'notes',
		primaryLabel: 'next',
	},
	{
		id: 'progress',
		title: 'Смотрите свой прогресс',
		body: 'Календарь, цели, статистика и «Мой год в книгах» помогут увидеть, сколько и как регулярно вы читаете.',
		note: 'Не забудьте иногда делать резервную копию.',
		illustration: 'progress',
		primaryLabel: 'start',
	},
]

export const ONBOARDING_SLIDE_COUNT = ONBOARDING_SLIDES.length
