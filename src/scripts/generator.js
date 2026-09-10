import { normalizeBook, generationMetadata, matchPublished } from '../../shared/books.mjs';
import { validateDiagram } from '../../shared/diagram-policy.mjs';
export async function searchOpenLibrary(query, signal) {
  const url = new URL('https://openlibrary.org/search.json');
  url.search = new URLSearchParams({ q: query, fields: 'title,author_name,first_publish_year,cover_i', limit: '12' }).toString();
  const response = await fetch(url, { signal }); if (!response.ok) throw new Error('Search unavailable');
  const data = await response.json();
  return (Array.isArray(data.docs) ? data.docs : []).slice(0, 12).flatMap(doc => {
    try { return [normalizeBook({ title: doc.title, authors: doc.author_name, publishYear: doc.first_publish_year, coverId: doc.cover_i })]; } catch { return []; }
  });
}
export function createGenerator({ getState, setState, initializeWorkspace, renderCandidate }) {
  let epoch = 0, timer, searchController, generationController, catalog = [];
  const catalogReady = fetch(`${import.meta.env.BASE_URL}catalog-index.json`).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => { catalog = data; }).catch(() => {});
  function invalidate() { epoch++; clearTimeout(timer); searchController?.abort(); generationController?.abort(); setState({ generateLoading: false, searchLoading: false }); }
  function selectBook(book) {
    if (getState().editorOpen) return;
    invalidate(); setState({ book: normalizeBook(book), graph: null, generatedAt: null, canonicalUrl: null, originalGraph: null, searchResults: [], searchQuery: '', error: null, downloadLoading: false, downloadStatus: null });
  }
  async function runSearch(query, token) {
    searchController = new AbortController(); setState({ searchLoading: true });
    try { const results = await searchOpenLibrary(query, searchController.signal); if (epoch === token) setState({ searchResults: results, searchLoading: false }); }
    catch (error) { if (epoch === token && error.name !== 'AbortError') setState({ searchResults: [], searchLoading: false, error: { scope: 'search', message: "Couldn't reach OpenLibrary. Enter the book details below." } }); }
  }
  function handleSearchInput(event) {
    if (getState().editorOpen) return;
    invalidate(); const query = event.target.value.trim(), token = epoch;
    setState({ searchQuery: query, searchResults: [], book: null, graph: null, error: null, downloadLoading: false });
    if (query.length >= 3) timer = setTimeout(() => runSearch(query, token), 300);
  }
  async function handleGenerateClick() {
    const state = getState(); if (!state.book || state.generateLoading || state.editorOpen) return;
    const book = normalizeBook(state.book), token = ++epoch;
    generationController = new AbortController(); const controller = generationController;
    setState({ generateLoading: true, error: null });
    const timeout = setTimeout(() => controller.abort(), 55000);
    try {
      const response = await fetch(import.meta.env.PUBLIC_API_BASE_URL || 'https://austen-api.potato0.workers.dev', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ book: generationMetadata(book) }) });
      const data = await response.json(); if (token !== epoch) return;
      if (!response.ok) throw new Error(data.code === 'UNKNOWN' ? 'The model could not confidently identify this book. Check its details or try another title.' : data.code === 'rate_limited' ? 'Please wait a minute before generating another map.' : 'Generation is temporarily unavailable. Please try again later.');
      const source = validateDiagram(data.mermaid).source;
      if (!Number.isFinite(Date.parse(data.generatedAt))) throw new Error('The generator returned an incomplete response.');
      const svg = await renderCandidate(source); if (token !== epoch) return;
      await initializeWorkspace({ book, mermaid: source, generatedAt: data.generatedAt, svg }, { remember: true });
    } catch (error) {
      if (token === epoch) setState({ generateLoading: false, error: { scope: 'generate', message: error.name === 'AbortError' ? 'Generation timed out. You can try again.' : error.message || 'The map could not be rendered.' } });
    } finally { clearTimeout(timeout); }
  }
  const form = document.getElementById('manual-book-form');
  form?.addEventListener('submit', event => { event.preventDefault(); if (getState().editorOpen) return; const data = new FormData(form); selectBook({ title: data.get('title'), authors: data.get('author') ? [data.get('author')] : [], year: data.get('year') }); });
  return { invalidate, selectBook, handleSearchInput, handleGenerateClick, publishedMatch: book => matchPublished(book, catalog), async preselect() {
    const token = epoch; await catalogReady; if (epoch !== token) return;
    const id = new URLSearchParams(location.search).get('book');
    if (id) { const book = catalog.find(b => b.id === id); if (book?.eligible || book?.publishedUrl) selectBook(book); else setState({ error: { scope: 'share', message: 'This catalog entry is unavailable for generation.' } }); }
  } };
}
