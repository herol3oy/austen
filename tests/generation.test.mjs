import assert from 'node:assert/strict'
import test from 'node:test'
import LZString from 'lz-string'
import { decompressShare } from '../shared/bounded-lz.mjs'
import { validateDiagram } from '../shared/diagram-policy.mjs'
import {
	classifyResponse,
	DEFAULT_MODEL,
	generateDiagram,
} from '../shared/generation.mjs'
import { graph } from './helpers.mjs'

test('provider request is metadata-only, includes legacy year, disables thinking, caps tokens', async () => {
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
			fetchImpl: async (url, options) => {
				assert.equal(url, 'https://api.deepseek.com/chat/completions')
				const body = JSON.parse(options.body)
				assert.equal(body.model, DEFAULT_MODEL)
				assert.equal(body.max_tokens, 1200)
				assert.equal(body.temperature, 0.2)
				assert.deepEqual(body.thinking, { type: 'disabled' })
				assert.equal(body.tools, undefined)
				assert.ok(options.body.includes('1813'))
				assert.ok(!options.body.includes('DO NOT SEND'))
				assert.ok(!options.body.includes('example.org'))
				return Response.json({
					choices: [{ message: { content: graph }, finish_reason: 'stop' }],
					model: 'reported-model',
					usage: { total_tokens: 80 },
				})
			},
		},
	)
	assert.equal(result.outcome, 'candidate')
	assert.equal(result.reportedModel, 'reported-model')
	assert.equal(
		classifyResponse({
			choices: [{ message: { content: 'UNKNOWN' }, finish_reason: 'stop' }],
		}).outcome,
		'unknown_work',
	)
	assert.equal(
		classifyResponse({
			choices: [{ message: { content: graph }, finish_reason: 'length' }],
		}).outcome,
		'invalid_graph',
	)
})
test('unsafe directives, HTML and overlarge graphs fail', () => {
	for (const source of [
		`${graph}\nclick A "javascript:alert(1)"`,
		`%%{init: {}}%%\n${graph}`,
		graph.replace('Elizabeth Bennet', '<img src=x>'),
		'x'.repeat(12001),
		`${graph}\nstyle A fill:red`,
	])
		assert.throws(() => validateDiagram(source))
})
test('provider classifies auth, 429, and timeouts without exposing raw errors', async () => {
	await assert.rejects(
		generateDiagram(
			{ title: 'Book', authors: [] },
			{
				apiKey: 'key',
				fetchImpl: async () =>
					new Response('secret raw upstream error', { status: 401 }),
			},
		),
		(e) => e.fatal && !e.message.includes('secret'),
	)
	await assert.rejects(
		generateDiagram(
			{ title: 'Book', authors: [] },
			{
				apiKey: 'key',
				fetchImpl: async () =>
					new Response('', { status: 429, headers: { 'Retry-After': '2' } }),
			},
		),
		(e) => e.retryable && e.retryAfterMs === 2000,
	)
	await assert.rejects(
		generateDiagram(
			{ title: 'Book', authors: [] },
			{
				apiKey: 'key',
				timeoutMs: 5,
				fetchImpl: (_, { signal }) =>
					new Promise((_, reject) =>
						signal.addEventListener('abort', () =>
							reject(new DOMException('aborted', 'AbortError')),
						),
					),
			},
		),
		(e) => e.code === 'timeout' && e.retryable,
	)
})

test('bounded decoder preserves LZ-String compatibility and rejects compressed expansion', () => {
	for (const value of [
		'a',
		'é'.repeat(100),
		JSON.stringify({ title: 'ドラキュラ', graph }),
		'a'.repeat(40000),
	])
		assert.equal(
			decompressShare(LZString.compressToEncodedURIComponent(value)),
			value,
		)
	assert.throws(
		() =>
			decompressShare(
				LZString.compressToEncodedURIComponent('a'.repeat(40001)),
			),
		/size limit/,
	)
	assert.throws(() => decompressShare('B'))
})
