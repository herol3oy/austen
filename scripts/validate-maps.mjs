import { load } from 'cheerio';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { validateDiagram, VALIDATOR_VERSION } from '../shared/diagram-policy.mjs';
import { checkSvgElements, checkSvgEnvelope } from '../shared/svg-policy.mjs';
import { ROOT, readJson, writeJson, atomicWrite, hash, withLock, isMain } from './files.mjs';
export const RENDERER_VERSION = 'mermaid-11.16.0/cli-11.17.0';
const execute = promisify(execFile);
export class RenderError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
export const PREFLIGHT_GRAPH = 'graph LR\nC1["Renderer"]\nC2["Ready"]\nC1 -->|Checks| C2';
export async function preflightRenderer({ renderer = renderSvg } = {}) {
  try { validateSvg(await renderer(PREFLIGHT_GRAPH)); }
  catch (error) {
    throw new RenderError('render_failed', `Browser preflight failed: ${error.message}. Install Chrome with pnpm exec puppeteer browsers install chrome, or set PUPPETEER_EXECUTABLE_PATH in .env.`);
  }
}
export function validateSvg(svg) {
  checkSvgEnvelope(svg);
  const $ = load(svg, { xml: true });
  if ($.root().children().length !== 1) throw new Error('Invalid SVG roots');
  return checkSvgElements($('*').toArray().map(n => ({ name: n.name, attributes: n.attribs, text: $(n).text() })));
}
export async function renderSvg(source) {
  validateDiagram(source);
  const dir = await mkdtemp(join(tmpdir(), 'austen-render-'));
  try {
    const input = join(dir, 'map.mmd'), output = join(dir, 'map.svg');
    await atomicWrite(input, source);
    const args = ['-i', input, '-o', output, '-c', resolve(ROOT, 'shared/mermaid.config.json'), '-b', 'transparent', '-q'];
    if (process.env.PUPPETEER_CONFIG) args.push('-p', resolve(process.env.PUPPETEER_CONFIG));
    try {
      await execute(resolve(ROOT, 'node_modules/.bin/mmdc'), args, { timeout: 60000, maxBuffer: 1000000 });
    } catch (error) {
      const detail = String(error.stderr || error.message).replace(/\x1b\[[0-9;]*m/g, '').trim().slice(0, 1200);
      const syntax = /Parse error|Lexical error|Syntax error|UnknownDiagramError|No diagram type detected/i.test(detail);
      throw new RenderError(syntax ? 'invalid_graph' : 'render_failed', detail || 'Mermaid renderer did not finish');
    }
    const svg = await readFile(output, 'utf8');
    try { validateSvg(svg); } catch (error) { throw new RenderError('invalid_graph', `SVG safety check failed: ${error.message}`); }
    return svg;
  } finally { await rm(dir, { recursive: true, force: true }); }
}
export async function revisionPaths(root = ROOT) {
  const base = resolve(root, 'data/maps');
  const dirs = await readdir(base, { withFileTypes: true }).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  const paths = [];
  for (const dir of dirs.filter(d => d.isDirectory())) for (const file of await readdir(join(base, dir.name))) if (/^v[1-9]\d*\.json$/.test(file)) paths.push(join(base, dir.name, file));
  return paths;
}
export async function validateRevision(path, { renderer = renderSvg } = {}) {
  const revision = await readJson(path);
  if (!['candidate', 'render_failed', 'valid'].includes(revision.outcome)) return revision;
  if (revision.mermaidHash !== hash(revision.mermaid)) throw new Error('Mermaid hash mismatch');
  if (revision.outcome === 'valid') {
    const svg = await readFile(path.replace(/\.json$/, '.svg'), 'utf8');
    validateDiagram(revision.mermaid); validateSvg(svg);
    if (hash(svg) !== revision.validation.svgHash) throw new Error('SVG hash mismatch');
    return revision;
  }
  try {
    try { validateDiagram(revision.mermaid); } catch (error) { throw new RenderError('invalid_graph', error.message); }
    const svg = await renderer(revision.mermaid);
    let dimensions;
    try { dimensions = validateSvg(svg); } catch (error) { throw new RenderError('invalid_graph', `SVG safety check failed: ${error.message}`); }
    await atomicWrite(path.replace(/\.json$/, '.svg'), svg);
    revision.outcome = 'valid';
    revision.validation = { status: 'valid', validatorVersion: VALIDATOR_VERSION, rendererVersion: RENDERER_VERSION, configHash: hash(await readFile(resolve(ROOT, 'shared/mermaid.config.json'))), mermaidHash: revision.mermaidHash, svgHash: hash(svg), validatedAt: new Date().toISOString(), ...dimensions };
  } catch (error) {
    revision.outcome = error.code === 'invalid_graph' ? 'invalid_graph' : 'render_failed';
    revision.validation = { status: revision.outcome, error: String(error.message).slice(0, 1400), validatedAt: new Date().toISOString() };
  }
  await writeJson(path, revision); return revision;
}
if (isMain(import.meta.url)) withLock(ROOT, async () => {
  const target = process.argv[2];
  for (const path of await revisionPaths()) {
    if (target && !path.includes(`/maps/${target}/`)) continue;
    const revision = await validateRevision(path); console.log(`${path}: ${revision.outcome}`);
    if (['render_failed', 'invalid_graph'].includes(revision.outcome)) process.exitCode = 1;
  }
}).catch(error => { console.error(error.message); process.exitCode = 1; });
