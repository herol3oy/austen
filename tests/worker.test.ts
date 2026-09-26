import { afterEach, expect, test, vi } from 'vitest'
import worker from '../worker/index.js'
import { graph } from './helpers'

const request = (
	book = { title: 'Book', authors: [], publishYear: 1813 },
	extra: RequestInit = {},
) =>
	new Request('https://worker.example/', {
		method: 'POST',
		headers: {
			Origin: 'http://localhost:4321',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ book }),
		...extra,
	})
const env = {
	GENERATION_ENABLED: 'true',
	DEEPSEEK_API_KEY: 'fixture-key',
	GENERATION_LIMITER: { limit: async () => ({ success: true }) },
}

afterEach(() => vi.unstubAllGlobals())

test('the Worker returns validated generations and redacts upstream errors', async () => {
	const fetch = vi.fn(async () =>
		Response.json({
			choices: [{ message: { content: graph }, finish_reason: 'stop' }],
		}),
	)
	vi.stubGlobal('fetch', fetch)
	let response = await worker.fetch(request(), env)
	expect(response.status).toBe(200)
	expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
		'http://localhost:4321',
	)
	expect((await response.json()).mermaid).toBe(graph)
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response('sensitive', { status: 401 })),
	)
	response = await worker.fetch(request(), env)
	expect(response.status).toBe(503)
	expect(await response.text()).not.toContain('sensitive')
})

test('the Worker rejects invalid input, unknown origins, limits, and disabled generation', async () => {
	const fetch = vi.fn()
	vi.stubGlobal('fetch', fetch)
	expect(
		(
			await worker.fetch(
				request({ title: 'Book', authors: 'bad' } as never),
				env,
			)
		).status,
	).toBe(400)
	expect(
		(
			await worker.fetch(
				request(undefined, { headers: { Origin: 'https://evil.example' } }),
				env,
			)
		).status,
	).toBe(403)
	expect(
		(await worker.fetch(request(), { ...env, GENERATION_ENABLED: 'false' }))
			.status,
	).toBe(503)
	const limited = await worker.fetch(request(), {
		...env,
		GENERATION_LIMITER: { limit: async () => ({ success: false }) },
	})
	expect(limited.status).toBe(429)
	expect(fetch).not.toHaveBeenCalled()
})
