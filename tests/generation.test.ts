import LZString from 'lz-string'
import { expect, test } from 'vitest'
import { decompressShare } from '../shared/bounded-lz.mjs'
import { validateDiagram } from '../shared/diagram-policy.mjs'
import {
	classifyResponse,
	DEFAULT_MODEL,
	generateDiagram,
} from '../shared/generation.mjs'
import { graph } from './helpers'

test('the provider receives bounded metadata and a candidate response is validated', async () => {
	const result = await generateDiagram(
		{
			title: 'Example',
			authors: ['Author'],
			publishYear: 1813,
			description: 'DO NOT SEND',
			ebookUrl: 'https://example.org/secret',
		},
		{
			apiKey: 'fixture-secret',
			fetchImpl: async (url: string | URL | Request, options?: RequestInit) => {
				expect(url).toBe('https://api.deepseek.com/chat/completions')
				const request = options ?? {}
				const body = JSON.parse(request.body as string)
				expect(body).toMatchObject({
					model: DEFAULT_MODEL,
					max_tokens: 1200,
					temperature: 0.2,
					thinking: { type: 'disabled' },
				})
				expect(request.body).toContain('1813')
				expect(request.body).not.toContain('DO NOT SEND')
				expect(request.body).not.toContain('example.org')
				return Response.json({
					choices: [{ message: { content: graph }, finish_reason: 'stop' }],
					model: 'reported-model',
					usage: { total_tokens: 80 },
				})
			},
		} as never,
	)
	expect(result.outcome).toBe('candidate')
	expect(result.reportedModel).toBe('reported-model')
	expect(
		classifyResponse({
			choices: [{ message: { content: 'UNKNOWN' }, finish_reason: 'stop' }],
		}).outcome,
	).toBe('unknown_work')
})

test('invalid graphs and upstream failures are safely rejected', async () => {
	for (const source of [
		`${graph}\nclick A "javascript:alert(1)"`,
		`%%{init: {}}%%\n${graph}`,
		graph.replace('Elizabeth Bennet', '<img src=x>'),
		'x'.repeat(12001),
	])
		expect(() => validateDiagram(source)).toThrow()

	await expect(
		generateDiagram({ title: 'Book', authors: [] }, {
			apiKey: 'key',
			fetchImpl: async () =>
				new Response('secret raw upstream error', { status: 401 }),
		} as never),
	).rejects.toMatchObject({ fatal: true })
	await expect(
		generateDiagram({ title: 'Book', authors: [] }, {
			apiKey: 'key',
			fetchImpl: async () =>
				new Response('', { status: 429, headers: { 'Retry-After': '2' } }),
		} as never),
	).rejects.toMatchObject({ retryable: true, retryAfterMs: 2000 })
})

test('the share decoder preserves LZ-String compatibility and enforces its size limit', () => {
	for (const value of ['a', 'é'.repeat(100), JSON.stringify({ graph })])
		expect(decompressShare(LZString.compressToEncodedURIComponent(value))).toBe(
			value,
		)
	expect(() =>
		decompressShare(LZString.compressToEncodedURIComponent('a'.repeat(40001))),
	).toThrow(/size limit/)
})
