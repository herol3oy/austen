import { generationMetadata } from '../shared/books.mjs';
import { generateDiagram, readLimitedText, DEFAULT_MODEL } from '../shared/generation.mjs';
const CORS_ORIGINS = ['https://herol3oy.github.io', 'http://localhost:4321', 'http://127.0.0.1:4321', 'http://localhost:8788'];
export function getCorsHeaders(origin) {
  return { ...(CORS_ORIGINS.includes(origin) ? { 'Access-Control-Allow-Origin': origin } : {}), 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '', headers = getCorsHeaders(origin);
    const reply = (status, code, error) => Response.json({ code, error }, { status, headers });
    if (origin && !CORS_ORIGINS.includes(origin)) return reply(403, 'origin_denied', 'Origin is not allowed.');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, 'method_not_allowed', 'Use POST.');
    if (env.GENERATION_ENABLED !== 'true') return reply(503, 'generation_disabled', 'Generation is temporarily unavailable.');
    if (!env.DEEPSEEK_API_KEY || !env.GENERATION_LIMITER) return reply(503, 'not_configured', 'Generation is temporarily unavailable.');
    if (!request.headers.get('content-type')?.startsWith('application/json')) return reply(415, 'invalid_content_type', 'Send JSON.');
    let book;
    try {
      const text = await readLimitedText(request, 4096);
      book = generationMetadata(JSON.parse(text).book);
    } catch { return reply(400, 'invalid_book', 'Provide a title, authors array, and optional year (up to 4 KB).'); }
    try {
      const { success } = await env.GENERATION_LIMITER.limit({ key: `generate:${request.headers.get('CF-Connecting-IP') || 'anonymous'}` });
      if (!success) return Response.json({ code: 'rate_limited', error: 'Please wait a minute before generating another map.' }, { status: 429, headers: { ...headers, 'Retry-After': '60' } });
      const result = await generateDiagram(book, { apiKey: env.DEEPSEEK_API_KEY, model: env.DEEPSEEK_MODEL || DEFAULT_MODEL });
      if (result.outcome === 'unknown_work') return reply(422, 'UNKNOWN', 'The model could not confidently identify this work.');
      if (result.outcome !== 'candidate') return reply(502, 'invalid_graph', 'The model returned an unusable map.');
      return Response.json({ mermaid: result.mermaid, generatedAt: result.generatedAt }, { headers });
    } catch { return reply(503, 'provider_error', 'Generation is temporarily unavailable.'); }
  },
};
