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
	const render = () => {
		const words = searchText(input.value).split(' ').filter(Boolean)
		const matches = rows.filter((row) =>
			words.every((word) => row.dataset.search.includes(word)),
		)
		const total = matches.length
		const visible = new Set(matches)
		for (const row of rows) {
			row.hidden = !visible.has(row)
		}
		count.textContent = `${total.toLocaleString()} ${total === 1 ? 'book' : 'books'}${words.length ? ' found' : ''}`
	}
	input.addEventListener(
		'input',
		() => {
			render()
		},
		{ signal },
	)
	render()
})
