import { searchText } from '../../shared/books.mjs'

let cleanup = () => {}

document.addEventListener('astro:page-load', () => {
	cleanup()
	const input = document.getElementById('library-search')
	if (!input) return
	const controller = new AbortController()
	const { signal } = controller
	cleanup = () => controller.abort()
	document.addEventListener('astro:before-swap', cleanup, {
		once: true,
		signal,
	})
	const rows = [...document.querySelectorAll('[data-library-book]')],
		count = document.getElementById('library-count')
	const list = document.querySelector('.library-list[data-page-size]')
	const pagination = document.querySelector('.library-pagination')
	const pageSize = Number(list?.dataset.pageSize)
	const paginated = pageSize > 0 && pagination
	let currentPage = 1
	if (paginated) {
		const params = new URL(location.href).searchParams
		input.value = params.get('q') || ''
		const page = params.get('page') || '1'
		if (/^[1-9]\d*$/.test(page)) currentPage = Number(page)
	}
	const pageButton = (
		label,
		page,
		{ disabled = false, current = false } = {},
	) => {
		const button = document.createElement('button')
		button.type = 'button'
		button.textContent = label
		button.dataset.page = String(page)
		button.disabled = disabled
		button.setAttribute(
			'aria-label',
			/^\d+$/.test(label) ? `Page ${label}` : `${label} page`,
		)
		if (current) button.setAttribute('aria-current', 'page')
		return button
	}
	const render = () => {
		const words = searchText(input.value).split(' ').filter(Boolean)
		const matches = rows.filter((row) =>
			words.every((word) => row.dataset.search.includes(word)),
		)
		const total = matches.length
		const lastPage = paginated ? Math.max(1, Math.ceil(total / pageSize)) : 1
		currentPage = Math.min(currentPage, lastPage)
		const start = paginated ? (currentPage - 1) * pageSize : 0
		const visible = new Set(
			paginated ? matches.slice(start, start + pageSize) : matches,
		)
		for (const row of rows) {
			row.hidden = !visible.has(row)
		}
		if (!paginated) {
			count.textContent = `${total.toLocaleString()} ${total === 1 ? 'book' : 'books'}${words.length ? ' found' : ''}`
			return
		}
		count.textContent = total
			? `Showing ${(start + 1).toLocaleString()}–${(start + visible.size).toLocaleString()} of ${total.toLocaleString()} ${words.length ? 'matching ' : ''}${total === 1 ? 'map' : 'maps'}`
			: 'No maps found'
		pagination.hidden = lastPage <= 1
		pagination.replaceChildren()
		if (lastPage > 1) {
			pagination.append(
				pageButton('Previous', currentPage - 1, {
					disabled: currentPage === 1,
				}),
			)
			const pages = new Set([
				1,
				lastPage,
				currentPage - 1,
				currentPage,
				currentPage + 1,
			])
			let previous = 0
			for (const page of [...pages]
				.filter((page) => page >= 1 && page <= lastPage)
				.sort((a, b) => a - b)) {
				if (page - previous === 2) {
					pagination.append(pageButton(String(previous + 1), previous + 1))
				} else if (page - previous > 2) {
					const gap = document.createElement('span')
					gap.textContent = '…'
					gap.setAttribute('aria-hidden', 'true')
					pagination.append(gap)
				}
				pagination.append(
					pageButton(String(page), page, { current: page === currentPage }),
				)
				previous = page
			}
			pagination.append(
				pageButton('Next', currentPage + 1, {
					disabled: currentPage === lastPage,
				}),
			)
		}
		const url = new URL(location.href)
		const query = input.value.trim()
		if (query) url.searchParams.set('q', query)
		else url.searchParams.delete('q')
		if (currentPage > 1) url.searchParams.set('page', String(currentPage))
		else url.searchParams.delete('page')
		if (url.href !== location.href) history.replaceState(history.state, '', url)
	}
	input.addEventListener(
		'input',
		() => {
			currentPage = 1
			render()
		},
		{ signal },
	)
	if (paginated)
		pagination.addEventListener(
			'click',
			(event) => {
				const button = event.target.closest('button[data-page]')
				if (
					!button ||
					button.disabled ||
					Number(button.dataset.page) === currentPage
				)
					return
				currentPage = Number(button.dataset.page)
				render()
				const heading = document.getElementById('library-heading')
				heading.focus({ preventScroll: true })
				heading.scrollIntoView({ block: 'start' })
			},
			{ signal },
		)
	render()
})
