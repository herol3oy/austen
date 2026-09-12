import mermaid from 'mermaid';
import Panzoom from '@panzoom/panzoom';
import config from '../../shared/mermaid.config.json';
import { sanitizeMermaid, validateDiagram } from '../../shared/diagram-policy.mjs';
import { normalizeBook } from '../../shared/books.mjs';
import { checkSvgEnvelope, checkSvgElements } from '../../shared/svg-policy.mjs';
import { encodeShare, decodeShare, loadHistory as readHistory, saveHistory as writeHistory, historyKey } from './share-history.js';
import { createGenerator } from './generator.js';




const HISTORY_LIMIT = 30;
const HISTORY_UNDO_DURATION_MS = 6000;
const STATUS_MESSAGE_DURATION_MS = 2500;
const DIAGRAM_MIN_SCALE = 0.5;
const DIAGRAM_MAX_SCALE = 4;
const DIAGRAM_ZOOM_STEP = 0.2;
const DIAGRAM_KEYBOARD_PAN_STEP = 40;
const EDITOR_PREVIEW_DELAY_MS = 400;
const PNG_EXPORT_SCALE = 2;
const PNG_EXPORT_MAX_DIMENSION = 8192;
const PNG_EXPORT_BACKGROUND = "#fbf9f4";

let state = {
  book: null,
  graph: null,
  generatedAt: null,
  canonicalUrl: null,
  originalGraph: null,
  searchQuery: "",
  searchResults: [],
  searchLoading: false,
  generateLoading: false,
  error: null,
  history: [],
  historyUndo: null,
  copyStatus: null,
  shareStatus: null,
  downloadStatus: null,
  downloadLoading: false,
  editorOpen: false,
  editorDraft: "",
  editorValidation: "idle",
  editorError: null,
};

let workspaceLoadToken = 0;
function setState(patch) {
  if ('book' in patch) workspaceLoadToken++;
  state = { ...state, ...patch };
  render();
}

function clearErrorScope(scope) {
  return state.error && state.error.scope === scope ? null : state.error;
}

const el = {
  globalStatus: document.getElementById("global-status"),
  searchInput: document.getElementById("search-input"),
  searchStatus: document.getElementById("search-status"),
  searchResults: document.getElementById("search-results"),

  selectedBookSection: document.getElementById("selected-book-section"),
  selectedBookCard: document.getElementById("selected-book-card"),
  generateStatus: document.getElementById("generate-status"),

  diagramWorkspace: document.getElementById("diagram-workspace"),
  mermaidSection: document.getElementById("mermaid-section"),
  mermaidContainer: document.getElementById("mermaid-container"),
  diagramControls: document.getElementById("diagram-controls"),
  diagramZoomLevel: document.getElementById("diagram-zoom-level"),
  zoomOutBtn: document.getElementById("zoom-out-btn"),
  zoomResetBtn: document.getElementById("zoom-reset-btn"),
  zoomInBtn: document.getElementById("zoom-in-btn"),

  actionsSection: document.getElementById("actions-section"),
  actionsIntro: document.getElementById("actions-intro"),
  copyBtn: document.getElementById("copy-btn"),
  editBtn: document.getElementById("edit-btn"),
  mermaidSource: document.getElementById("mermaid-source"),
  copyStatus: document.getElementById("copy-status"),
  shareBtn: document.getElementById("share-btn"),
  shareUrlInput: document.getElementById("share-url-input"),
  shareStatus: document.getElementById("share-status"),
  downloadPngBtn: document.getElementById("download-png-btn"),
  downloadSvgBtn: document.getElementById("download-svg-btn"),
  downloadActions: document.getElementById("download-actions"),
  downloadStatus: document.getElementById("download-status"),

  editorSection: document.getElementById("editor-section"),
  editorInput: document.getElementById("editor-input"),
  editorStatus: document.getElementById("editor-status"),
  editorRevertBtn: document.getElementById("editor-revert-btn"),
  editorCancelBtn: document.getElementById("editor-cancel-btn"),
  editorSaveBtn: document.getElementById("editor-save-btn"),

  historyHeading: document.getElementById("history-heading"),
  historyCount: document.getElementById("history-count"),
  historyStatus: document.getElementById("history-status"),
  historyUndoBtn: document.getElementById("history-undo-btn"),
  historyList: document.getElementById("history-list"),
};

let lastRenderedGraph = null;
let diagramPanzoom = null;
let diagramInteractionController = null;
let diagramRenderToken = 0;
let cleanDiagramSvg = null;
let editorPreviewTimer = null;
let editorValidationToken = 0;
let lastValidDraftGraph = null;
let lastValidDraftSvg = null;
let historyUndoTimer = null;

function render() {
  document.body.classList.toggle("has-selection", Boolean(state.book));
  document.body.classList.toggle("has-graph", Boolean(state.graph));
  renderGlobalStatus();
  renderSearch();
  renderSelectedBook();
  renderMermaidSection();
  renderActions();
  renderEditor();
  renderHistory();
}

function renderGlobalStatus() {
  if (state.error && (state.error.scope === "share" || (state.error.scope === "history" && !el.historyList))) {
    setStatus(el.globalStatus, state.error.message, "error");
  } else {
    setStatus(el.globalStatus, "", null);
  }
}

function renderSearch() {
  if (!el.searchInput) return;
  el.searchInput.disabled = state.editorOpen;
  el.searchInput.placeholder = state.book ? "Find another book" : "Search by title or author";

  if (state.searchLoading) {
    setStatus(el.searchStatus, "Searching…", null);
  } else if (state.error && state.error.scope === "search") {
    setStatus(el.searchStatus, state.error.message, "error");
  } else if (state.searchQuery.length >= 3 && state.searchResults.length === 0) {
    setStatus(el.searchStatus, "No books found. Try a different title or author.", null);
  } else {
    setStatus(el.searchStatus, "", null);
  }

  el.searchResults.innerHTML = "";
  for (const book of state.searchResults) {
    el.searchResults.appendChild(buildCatalogCard(book));
  }
}

function buildCatalogCard(book) {
  const li = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "catalog-card";
  button.disabled = state.editorOpen;
  button.addEventListener("click", () => selectBook(book));

  button.appendChild(buildCoverElement(book, 44, 62));

  const meta = document.createElement("div");
  meta.className = "meta";
  const title = document.createElement("strong");
  title.textContent = book.title;
  const author = document.createElement("span");
  author.textContent = book.authors.length
    ? book.authors.slice(0, 2).join(", ") +
    (book.authors.length > 2 ? ` +${book.authors.length - 2} more` : "")
    : "Unknown author";
  const year = document.createElement("span");
  year.textContent = book.year ? String(book.year) : "Year unknown";
  meta.append(title, author, year);

  button.appendChild(meta);
  li.appendChild(button);
  return li;
}

function buildCoverElement(book, width, height) {
  if (book.coverPath) {
    const img = document.createElement("img");
    img.src = book.coverPath;
    img.alt = `Cover of ${book.title}`;
    img.width = width;
    img.height = height;
    img.loading = "lazy";
    img.addEventListener("error", () => {
      img.replaceWith(buildPlaceholderCover(width, height));
    });
    return img;
  }
  return buildPlaceholderCover(width, height);
}

function buildPlaceholderCover(width, height) {
  const div = document.createElement("div");
  div.className = "cover-placeholder";
  div.style.width = `${width}px`;
  div.style.height = `${height}px`;
  div.textContent = "A";
  div.setAttribute("aria-hidden", "true");
  return div;
}

function renderSelectedBook() {
  if (!el.selectedBookSection) return;
  el.selectedBookSection.hidden = !state.book;
  if (!state.book) return;

  el.selectedBookCard.innerHTML = "";
  el.selectedBookCard.appendChild(buildCoverElement(state.book, 72, 100));

  const details = document.createElement("div");
  details.className = "details";
  const h3 = document.createElement("h3");
  h3.id = "selected-book-heading";
  h3.textContent = state.book.title;
  const authorP = document.createElement("p");
  authorP.textContent = state.book.authors.length
    ? state.book.authors.join(", ")
    : "Unknown author";
  const yearP = document.createElement("p");
  yearP.textContent = state.book.year
    ? String(state.book.year)
    : "Year unknown";
  details.append(h3, authorP, yearP);

  const actions = document.createElement("div");
  actions.className = "actions";
  const generateBtn = document.createElement("button");
  generateBtn.type = "button";
  generateBtn.textContent = state.generateLoading ? "Generating\u2026" : "Generate diagram";
  generateBtn.disabled = state.generateLoading || state.editorOpen;
  generateBtn.addEventListener("click", handleGenerateClick);
  const existing = generator?.publishedMatch(state.book);
  if (existing) {
    const link = document.createElement('a'); link.href = existing.publishedUrl;
    link.className = 'published-offer'; link.textContent = 'Open the published map';
    actions.appendChild(link); generateBtn.textContent = 'Generate another map';
  }
  actions.appendChild(generateBtn);

  el.selectedBookCard.append(details, actions);

  if (state.error && state.error.scope === "generate") {
    setStatus(el.generateStatus, state.error.message, "error");
  } else if (state.generateLoading) {
    setStatus(el.generateStatus, "Asking the backend for a diagram\u2026", null);
  } else {
    setStatus(el.generateStatus, "", null);
  }
}

function renderMermaidSection() {
  el.diagramWorkspace.hidden = !state.graph;
  el.mermaidSection.hidden = !state.graph;
  if (!state.graph) {
    cleanDiagramSvg = null;
    if (lastRenderedGraph !== null || diagramPanzoom) {
      diagramRenderToken += 1;
      destroyDiagramPanzoom();
    }
    lastRenderedGraph = null;
    return;
  }
  if (state.graph !== lastRenderedGraph) {
    lastRenderedGraph = state.graph;
    renderMermaidGraph(state.graph);
  }
}

function renderActions() {
  el.actionsSection.hidden = !state.graph;
  el.actionsSection.classList.toggle("is-editing", state.editorOpen);
  el.actionsIntro.textContent = state.editorOpen
    ? "Save or cancel your edits before copying, sharing, or downloading this map."
    : "Take the map with you, or use its Mermaid source in your own notes.";

  if (state.graph) {
    el.mermaidSource.value = state.graph;
    el.shareUrlInput.value = buildShareUrl();
  } else {
    el.mermaidSource.value = "";
    el.shareUrlInput.value = "";
  }

  const actionsLocked = state.editorOpen;
  const downloadReady = Boolean(
    state.graph && cleanDiagramSvg && !state.downloadLoading && !actionsLocked,
  );
  el.copyBtn.disabled = !state.graph || actionsLocked;
  el.shareBtn.disabled = !state.graph || actionsLocked;
  el.editBtn.disabled =
    !state.graph || !cleanDiagramSvg || state.downloadLoading || actionsLocked;
  el.downloadPngBtn.disabled = !downloadReady;
  el.downloadSvgBtn.disabled = !downloadReady;
  el.downloadActions.setAttribute("aria-busy", String(state.downloadLoading));

  if (state.copyStatus) {
    setStatus(el.copyStatus, state.copyStatus.text, state.copyStatus.tone);
  } else {
    setStatus(el.copyStatus, "", null);
  }

  if (state.shareStatus) {
    setStatus(el.shareStatus, state.shareStatus.text, state.shareStatus.tone);
  } else {
    setStatus(el.shareStatus, "", null);
  }

  if (state.downloadStatus) {
    setStatus(el.downloadStatus, state.downloadStatus.text, state.downloadStatus.tone);
  } else {
    setStatus(el.downloadStatus, "", null);
  }
}

function isEditorDirty() {
  return state.editorOpen && sanitizeMermaid(state.editorDraft) !== state.graph;
}

function renderEditor() {
  el.editorSection.hidden = !state.graph || !state.editorOpen;
  if (!state.editorOpen) return;

  if (el.editorInput.value !== state.editorDraft) {
    el.editorInput.value = state.editorDraft;
  }

  const dirty = isEditorDirty();
  const normalizedDraft = sanitizeMermaid(state.editorDraft);
  const previewReady =
    state.editorValidation === "valid" &&
    normalizedDraft.length > 0 &&
    lastValidDraftGraph === normalizedDraft &&
    Boolean(lastValidDraftSvg);

  el.editorSection.setAttribute(
    "aria-busy",
    String(state.editorValidation === "checking"),
  );
  el.editorRevertBtn.disabled = !dirty;
  el.editorSaveBtn.disabled = !dirty || !previewReady;

  if (state.editorValidation === "checking") {
    setStatus(el.editorStatus, "Checking syntax and updating the preview\u2026", null);
  } else if (state.editorValidation === "invalid") {
    setStatus(
      el.editorStatus,
      state.editorError || "The Mermaid source needs a correction.",
      "error",
    );
  } else if (dirty && previewReady) {
    setStatus(el.editorStatus, "Preview updated. Ready to save.", "success");
  } else {
    setStatus(el.editorStatus, "Make a change to refine this diagram.", null);
  }
}

function renderHistory() {
  if (!el.historyList) return;
  el.historyHeading.textContent = "Recent volumes";
  el.historyCount.textContent = state.history.length
    ? `${state.history.length} ${state.history.length === 1 ? "map" : "maps"}`
    : "Your shelf";

  el.historyUndoBtn.hidden = !state.historyUndo;
  if (state.historyUndo) {
    el.historyUndoBtn.setAttribute(
      "aria-label",
      `Undo deleting ${state.historyUndo.entry.book.title} from Recent volumes`,
    );
  } else {
    el.historyUndoBtn.removeAttribute("aria-label");
  }

  if (state.error && state.error.scope === "history") {
    setStatus(el.historyStatus, state.error.message, "error");
  } else if (state.historyUndo) {
    setStatus(
      el.historyStatus,
      `Removed “${state.historyUndo.entry.book.title}” from Recent volumes.`,
      "success",
    );
  } else if (state.history.length === 0) {
    setStatus(el.historyStatus, "Diagrams you generate will be saved here.", null);
  } else {
    setStatus(el.historyStatus, "", null);
  }

  el.historyList.innerHTML = "";
  for (const entry of state.history) {
    el.historyList.appendChild(buildHistoryItem(entry));
  }
}

function buildHistoryItem(entry) {
  const li = document.createElement("li");
  li.className = "shelf-row";

  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "shelf-item";
  openButton.disabled = state.editorOpen;
  openButton.addEventListener("click", () => restoreFromHistory(entry));

  const title = document.createElement("span");
  title.className = "shelf-title";
  title.textContent = entry.book.title;

  const meta = document.createElement("span");
  meta.className = "shelf-meta";
  meta.textContent = formatTimestamp(entry.generatedAt);

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "shelf-delete";
  deleteButton.disabled = state.editorOpen;
  deleteButton.title = `Delete ${entry.book.title} from Recent volumes`;
  deleteButton.setAttribute(
    "aria-label",
    `Delete ${entry.book.title} from Recent volumes`,
  );
  deleteButton.innerHTML = `
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path d="M4.5 6h11M8 3.75h4M6.25 6l.55 10h6.4l.55-10M8.25 8.5v5M11.75 8.5v5"
        fill="none" stroke="currentColor" stroke-width="1.45"
        stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
  `;
  deleteButton.addEventListener("click", () => handleDeleteHistory(entry));

  openButton.append(title, meta);
  li.append(openButton, deleteButton);
  return li;
}

function formatTimestamp(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function setStatus(node, text, tone) {
  node.textContent = text || "";
  if (tone) {
    node.dataset.tone = tone;
  } else {
    delete node.dataset.tone;
  }
}

const generator = el.searchInput ? createGenerator({ getState: () => state, setState, initializeWorkspace, renderCandidate }) : null;
function handleSearchInput(event) { generator?.handleSearchInput(event); }
function selectBook(book) { generator?.selectBook(book); }
function handleGenerateClick() { generator?.handleGenerateClick(); }
mermaid.initialize(config);
function validateBrowserSvg(svg) {
  checkSvgEnvelope(svg);
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  if (doc.querySelector('parsererror')) throw new Error('Invalid SVG');
  checkSvgElements([...doc.querySelectorAll('*')].map(n => ({ name: n.localName, attributes: Object.fromEntries([...n.attributes].map(a => [a.name, a.value])), text: n.textContent })));
}
async function renderCandidate(source) {
  validateDiagram(source, { legacy: true });
  const { svg } = await mermaid.render(`candidate-${crypto.randomUUID()}`, source);
  validateBrowserSvg(svg); return svg;
}
export async function initializeWorkspace({ book, mermaid: source, generatedAt = null, svg, canonicalUrl = null }, { remember = false } = {}) {
  const loadToken = ++workspaceLoadToken;
  const normalizedBook = normalizeBook(book); const graph = validateDiagram(source, { legacy: true }).source;
  if (!svg) svg = await renderCandidate(graph);
  if (loadToken !== workspaceLoadToken) return;
  validateBrowserSvg(svg);
  cancelEditorPreviewWork(); diagramRenderToken++;
  cleanDiagramSvg = svg; lastRenderedGraph = graph;
  state = { ...state, ...getClosedEditorState(), book: normalizedBook, graph, generatedAt, canonicalUrl, originalGraph: canonicalUrl ? graph : null, error: null, generateLoading: false, downloadLoading: false };
  render(); displayDiagramSvg(svg); renderActions();
  if (remember) addHistoryEntry(normalizedBook, graph, generatedAt);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function updateDiagramZoomLevel(scale) {
  const normalizedScale = Math.min(
    DIAGRAM_MAX_SCALE,
    Math.max(DIAGRAM_MIN_SCALE, Number(scale) || 1),
  );
  const percentage = Math.round(normalizedScale * 100);

  el.diagramZoomLevel.textContent = `${percentage}%`;
  el.zoomResetBtn.setAttribute(
    "aria-label",
    `Reset diagram view. Current zoom ${percentage}%`,
  );
  el.zoomOutBtn.disabled = normalizedScale <= DIAGRAM_MIN_SCALE + 0.001;
  el.zoomInBtn.disabled = normalizedScale >= DIAGRAM_MAX_SCALE - 0.001;
}

function destroyDiagramPanzoom() {
  if (diagramInteractionController) {
    diagramInteractionController.abort();
    diagramInteractionController = null;
  }

  if (diagramPanzoom) {
    diagramPanzoom.resetStyle();
    diagramPanzoom.destroy();
    diagramPanzoom = null;
  }

  el.diagramControls.hidden = true;
  el.mermaidContainer.tabIndex = -1;
  el.mermaidContainer.classList.remove("is-interactive", "is-panning");
  updateDiagramZoomLevel(1);
}

function initializeDiagramPanzoom() {
  const svg = el.mermaidContainer.querySelector("svg");
  if (!svg || typeof Panzoom !== "function") return;

  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.setAttribute("text-rendering", "geometricPrecision");

  try {
    diagramPanzoom = Panzoom(svg, {
      minScale: DIAGRAM_MIN_SCALE,
      maxScale: DIAGRAM_MAX_SCALE,
      step: DIAGRAM_ZOOM_STEP,
      touchAction: "none",
      cursor: "grab",
    });
  } catch (err) {
    console.warn("Diagram pan and zoom could not be initialized.", err);
    destroyDiagramPanzoom();
    return;
  }

  diagramInteractionController = new AbortController();
  const { signal } = diagramInteractionController;

  const handleWheel = (event) => {
    event.preventDefault();
    diagramPanzoom?.zoomWithWheel(event);
  };

  const handleKeydown = (event) => {
    if (!diagramPanzoom || event.altKey || event.ctrlKey || event.metaKey) return;

    let handled = true;
    switch (event.key) {
      case "+":
      case "=":
        diagramPanzoom.zoomIn({ animate: !prefersReducedMotion() });
        break;
      case "-":
        diagramPanzoom.zoomOut({ animate: !prefersReducedMotion() });
        break;
      case "0":
      case "Home":
        diagramPanzoom.reset({ animate: !prefersReducedMotion() });
        break;
      case "ArrowLeft":
        diagramPanzoom.pan(-DIAGRAM_KEYBOARD_PAN_STEP, 0, { relative: true });
        break;
      case "ArrowRight":
        diagramPanzoom.pan(DIAGRAM_KEYBOARD_PAN_STEP, 0, { relative: true });
        break;
      case "ArrowUp":
        diagramPanzoom.pan(0, -DIAGRAM_KEYBOARD_PAN_STEP, { relative: true });
        break;
      case "ArrowDown":
        diagramPanzoom.pan(0, DIAGRAM_KEYBOARD_PAN_STEP, { relative: true });
        break;
      default:
        handled = false;
    }

    if (handled) event.preventDefault();
  };

  el.mermaidContainer.addEventListener("wheel", handleWheel, {
    passive: false,
    signal,
  });
  el.mermaidContainer.addEventListener("keydown", handleKeydown, { signal });
  el.mermaidContainer.addEventListener(
    "pointerdown",
    () => el.mermaidContainer.focus({ preventScroll: true }),
    { capture: true, signal },
  );
  svg.addEventListener(
    "panzoomchange",
    (event) => updateDiagramZoomLevel(event.detail.scale),
    { signal },
  );
  svg.addEventListener(
    "panzoomstart",
    () => el.mermaidContainer.classList.add("is-panning"),
    { signal },
  );
  svg.addEventListener(
    "panzoomend",
    () => el.mermaidContainer.classList.remove("is-panning"),
    { signal },
  );

  el.mermaidContainer.classList.add("is-interactive");
  el.mermaidContainer.tabIndex = 0;
  el.diagramControls.hidden = false;
  updateDiagramZoomLevel(diagramPanzoom.getScale());
}

function displayDiagramSvg(svg) {
  destroyDiagramPanzoom();
  validateBrowserSvg(svg);
  el.mermaidContainer.innerHTML = svg;
  el.mermaidContainer.setAttribute("aria-busy", "false");
  initializeDiagramPanzoom();
}

function displayMermaidFallback(graphDefinition) {
  destroyDiagramPanzoom();
  el.mermaidContainer.innerHTML = "";
  const pre = document.createElement("pre");
  pre.className = "mermaid-fallback";
  pre.textContent = graphDefinition;
  el.mermaidContainer.appendChild(pre);
  el.mermaidContainer.setAttribute("aria-busy", "false");
}

async function renderMermaidGraph(graphDefinition) {
  const renderToken = ++diagramRenderToken;
  cleanDiagramSvg = null;
  el.mermaidContainer.setAttribute("aria-busy", "true");
  renderActions();

  try {
    const svg = await renderCandidate(graphDefinition);
    if (renderToken !== diagramRenderToken) return;
    cleanDiagramSvg = svg;
    displayDiagramSvg(svg);
    renderActions();
  } catch (err) {
    if (renderToken !== diagramRenderToken) return;
    cleanDiagramSvg = null;
    displayMermaidFallback(graphDefinition);
    renderActions();
  }
}

function getClosedEditorState() {
  return {
    editorOpen: false,
    editorDraft: "",
    editorValidation: "idle",
    editorError: null,
  };
}

function cancelEditorPreviewWork() {
  if (editorPreviewTimer) {
    clearTimeout(editorPreviewTimer);
    editorPreviewTimer = null;
  }
  editorValidationToken += 1;
}

function clearEditorPreviewSnapshot() {
  lastValidDraftGraph = null;
  lastValidDraftSvg = null;
}

function formatMermaidEditorError(error) {
  const message = error && error.message ? String(error.message) : "";
  const lineMatch = message.match(/line\s+(\d+)/i);
  if (lineMatch) {
    return `Syntax error near line ${lineMatch[1]}. Check the relationship or character syntax.`;
  }
  return "The Mermaid source has a syntax error. Check the edited line and try again.";
}

function handleEditClick() {
  if (!state.graph || !cleanDiagramSvg || state.editorOpen) return;

  cancelEditorPreviewWork();
  lastValidDraftGraph = state.graph;
  lastValidDraftSvg = cleanDiagramSvg;
  setState({
    editorOpen: true,
    editorDraft: state.graph,
    editorValidation: "valid",
    editorError: null,
    copyStatus: null,
    shareStatus: null,
    downloadStatus: null,
  });

  requestAnimationFrame(() => {
    el.editorSection.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "nearest",
    });
    el.editorInput.focus({ preventScroll: true });
  });
}

function handleEditorInput(event) {
  const draft = event.target.value;
  cancelEditorPreviewWork();
  const validationToken = editorValidationToken;
  const normalizedDraft = sanitizeMermaid(draft);

  if (!normalizedDraft) {
    setState({
      editorDraft: draft,
      editorValidation: "invalid",
      editorError: "Enter Mermaid source before saving.",
    });
    return;
  }

  setState({
    editorDraft: draft,
    editorValidation: "checking",
    editorError: null,
  });
  editorPreviewTimer = setTimeout(
    () => validateAndPreviewEditorDraft(draft, validationToken),
    EDITOR_PREVIEW_DELAY_MS,
  );
}

async function validateAndPreviewEditorDraft(draft, validationToken) {
  editorPreviewTimer = null;
  const normalizedDraft = sanitizeMermaid(draft);

  try {
    validateDiagram(normalizedDraft, { legacy: true });
    await mermaid.parse(normalizedDraft);
  } catch (error) {
    if (
      validationToken !== editorValidationToken ||
      !state.editorOpen ||
      state.editorDraft !== draft
    ) {
      return;
    }
    setState({
      editorValidation: "invalid",
      editorError: formatMermaidEditorError(error),
    });
    return;
  }

  if (
    validationToken !== editorValidationToken ||
    !state.editorOpen ||
    state.editorDraft !== draft
  ) {
    return;
  }

  const renderToken = ++diagramRenderToken;

  try {
    const svg = await renderCandidate(normalizedDraft);
    if (
      validationToken !== editorValidationToken ||
      renderToken !== diagramRenderToken ||
      !state.editorOpen ||
      state.editorDraft !== draft
    ) {
      return;
    }

    lastValidDraftGraph = normalizedDraft;
    lastValidDraftSvg = svg;
    displayDiagramSvg(svg);
    setState({
      editorValidation: "valid",
      editorError: null,
    });
  } catch (error) {
    if (
      validationToken !== editorValidationToken ||
      renderToken !== diagramRenderToken ||
      !state.editorOpen ||
      state.editorDraft !== draft
    ) {
      return;
    }
    setState({
      editorValidation: "invalid",
      editorError: formatMermaidEditorError(error),
    });
  }
}

function restoreCommittedDiagram() {
  diagramRenderToken += 1;
  if (cleanDiagramSvg) {
    displayDiagramSvg(cleanDiagramSvg);
  } else if (state.graph) {
    lastRenderedGraph = state.graph;
    renderMermaidGraph(state.graph);
  }
}

function handleEditorRevert() {
  if (!state.editorOpen || !isEditorDirty()) return;

  cancelEditorPreviewWork();
  restoreCommittedDiagram();
  lastValidDraftGraph = state.graph;
  lastValidDraftSvg = cleanDiagramSvg;
  setState({
    editorDraft: state.graph,
    editorValidation: "valid",
    editorError: null,
  });
  requestAnimationFrame(() => el.editorInput.focus({ preventScroll: true }));
}

function handleEditorCancel() {
  if (!state.editorOpen) return;
  if (isEditorDirty() && !window.confirm("Discard your unsaved diagram edits?")) return;

  cancelEditorPreviewWork();
  restoreCommittedDiagram();
  clearEditorPreviewSnapshot();
  setState(getClosedEditorState());
  requestAnimationFrame(() => el.editBtn.focus({ preventScroll: true }));
}

function handleEditorSave() {
  const normalizedDraft = sanitizeMermaid(state.editorDraft);
  const ready =
    state.editorOpen &&
    isEditorDirty() &&
    state.editorValidation === "valid" &&
    normalizedDraft === lastValidDraftGraph &&
    Boolean(lastValidDraftSvg);
  if (!ready) return;

  cancelEditorPreviewWork();
  cleanDiagramSvg = lastValidDraftSvg;
  lastRenderedGraph = normalizedDraft;
  clearEditorPreviewSnapshot();
  const book = state.book;

  setState({
    ...getClosedEditorState(),
    graph: normalizedDraft,
    copyStatus: null,
    shareStatus: null,
    downloadStatus: null,
    downloadLoading: false,
  });
  addHistoryEntry(book, normalizedDraft, state.generatedAt);
  flashStatus("copyStatus", "Diagram changes saved.", "success");
  requestAnimationFrame(() => el.editBtn.focus({ preventScroll: true }));
}

function handleEditorKeydown(event) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    handleEditorSave();
  }
}

function buildShareUrl() {
  if (state.canonicalUrl && state.graph === state.originalGraph) return state.canonicalUrl;
  return encodeShare({ book: state.book, mermaid: state.graph, generatedAt: state.generatedAt }, new URL(`${import.meta.env.BASE_URL}generate/`, location.origin));
}

async function handleShareClick() {
  if (state.editorOpen) return;

  try {
    await copyText(el.shareUrlInput.value);

    flashStatus(
      "shareStatus",
      "Share link copied to clipboard.",
      "success"
    );
  } catch (err) {
    console.error("Failed to copy share link:", err);

    flashStatus(
      "shareStatus",
      "Couldn't copy the share link.",
      "error"
    );
  }
}

async function restoreFromShareUrl() {
  const compressed = new URLSearchParams(location.search).get('graph');
  if (!compressed) return false;
  try { await initializeWorkspace(decodeShare(compressed)); return true; }
  catch { setState({ error: { scope: 'share', message: "That share link looks corrupted or unsupported, so it wasn't loaded." } }); return false; }
}
function loadHistory() { return readHistory(); }
function saveHistory(list) {
  if (writeHistory(list)) return true;
  setState({ error: { scope: 'history', message: "Couldn't save history locally (storage may be full)." } }); return false;
}

function clearHistoryUndoTimer() {
  if (historyUndoTimer) {
    clearTimeout(historyUndoTimer);
    historyUndoTimer = null;
  }
}

function focusHistoryEntry(book) {
  const key = historyKey(book);
  const index = state.history.findIndex((entry) => historyKey(entry.book) === key);
  if (index < 0) return;
  const row = el.historyList.children[index];
  row?.querySelector(".shelf-item")?.focus({ preventScroll: true });
}

function handleDeleteHistory(entry) {
  if (state.editorOpen) return;

  const key = historyKey(entry.book);
  const index = state.history.findIndex((item) => historyKey(item.book) === key);
  if (index < 0) return;

  clearHistoryUndoTimer();
  const nextHistory = state.history.slice();
  const [removedEntry] = nextHistory.splice(index, 1);
  const pendingUndo = { entry: removedEntry, index };

  setState({
    history: nextHistory,
    historyUndo: pendingUndo,
    error: clearErrorScope("history"),
  });
  saveHistory(nextHistory);

  historyUndoTimer = setTimeout(() => {
    historyUndoTimer = null;
    if (state.historyUndo !== pendingUndo) return;

    const undoHadFocus = document.activeElement === el.historyUndoBtn;
    setState({ historyUndo: null });
    if (undoHadFocus) {
      requestAnimationFrame(() => el.historyHeading.focus({ preventScroll: true }));
    }
  }, HISTORY_UNDO_DURATION_MS);

  requestAnimationFrame(() => {
    if (!el.historyUndoBtn.hidden) {
      el.historyUndoBtn.focus({ preventScroll: true });
    }
  });
}

function handleHistoryUndo() {
  const pendingUndo = state.historyUndo;
  if (!pendingUndo) return;

  clearHistoryUndoTimer();
  const key = historyKey(pendingUndo.entry.book);
  const existingIndex = state.history.findIndex(
    (entry) => historyKey(entry.book) === key,
  );
  let nextHistory = state.history;

  if (existingIndex < 0) {
    nextHistory = state.history.slice();
    const restoreIndex = Math.min(pendingUndo.index, nextHistory.length);
    nextHistory.splice(restoreIndex, 0, pendingUndo.entry);
  }

  setState({
    history: nextHistory,
    historyUndo: null,
    error: clearErrorScope("history"),
  });
  saveHistory(nextHistory);
  requestAnimationFrame(() => focusHistoryEntry(pendingUndo.entry.book));
}

function addHistoryEntry(book, mermaidStr, generatedAt) {
  const key = historyKey(book);
  const withoutDuplicate = state.history.filter((entry) => historyKey(entry.book) !== key);
  const nextHistory = [{ book, mermaid: mermaidStr, generatedAt }, ...withoutDuplicate].slice(
    0,
    HISTORY_LIMIT,
  );
  setState({ history: nextHistory });
  saveHistory(nextHistory);
}

async function restoreFromHistory(entry) {
  if (state.editorOpen) return;
  generator?.invalidate();
  try { await initializeWorkspace(entry); history.replaceState(null, '', buildShareUrl()); }
  catch { setState({ error: { scope: 'history', message: 'This saved map could not be rendered.' } }); }
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

async function handleCopyClick() {
  if (state.editorOpen || !el.mermaidSource.value) return;

  try {
    await copyText(el.mermaidSource.value);
    flashStatus(
      "copyStatus",
      "Mermaid source copied to clipboard.",
      "success"
    );
  } catch (err) {
    console.error("Failed to copy Mermaid source:", err);

    flashStatus(
      "copyStatus",
      "Couldn't copy to clipboard.",
      "error"
    );
  }
}

function buildDiagramFilename(extension) {
  const title = state.book && typeof state.book.title === "string" ? state.book.title : "";
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return `${slug || "austen"}-relationship-diagram.${extension}`;
}

function getNormalizedDiagramSvg(backgroundColor = null) {
  if (!cleanDiagramSvg) throw new Error("No rendered diagram is available.");

  const documentNode = new DOMParser().parseFromString(cleanDiagramSvg, "image/svg+xml");
  if (documentNode.querySelector("parsererror")) {
    throw new Error("The rendered diagram could not be parsed.");
  }

  const svg = documentNode.documentElement;
  const viewBox = (svg.getAttribute("viewBox") || "")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (
    viewBox.length !== 4 ||
    viewBox.some((value) => !Number.isFinite(value)) ||
    viewBox[2] <= 0 ||
    viewBox[3] <= 0
  ) {
    throw new Error("The rendered diagram has invalid dimensions.");
  }

  const [x, y, width, height] = viewBox;
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.style.removeProperty("max-width");
  svg.style.removeProperty("background-color");
  svg.style.removeProperty("transform");
  svg.style.removeProperty("transform-origin");
  svg.style.removeProperty("cursor");
  svg.style.removeProperty("touch-action");
  svg.removeAttribute("tabindex");

  if (!svg.getAttribute("style")) {
    svg.removeAttribute("style");
  }

  if (backgroundColor) {
    const background = documentNode.createElementNS("http://www.w3.org/2000/svg", "rect");
    background.setAttribute("x", String(x));
    background.setAttribute("y", String(y));
    background.setAttribute("width", String(width));
    background.setAttribute("height", String(height));
    background.setAttribute("fill", backgroundColor);
    svg.insertBefore(background, svg.firstChild);
  }

  return {
    markup: new XMLSerializer().serializeToString(svg),
    width,
    height,
  };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function loadSvgImage(markup) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The diagram could not be rasterized."));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("The PNG file could not be created."));
      }
    }, "image/png");
  });
}

async function createDiagramPng() {
  const { markup, width, height } = getNormalizedDiagramSvg(PNG_EXPORT_BACKGROUND);
  const scale = Math.min(
    PNG_EXPORT_SCALE,
    PNG_EXPORT_MAX_DIMENSION / width,
    PNG_EXPORT_MAX_DIMENSION / height,
  );
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error("The diagram is too large to export.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width * scale));
  canvas.height = Math.max(1, Math.ceil(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas export is not supported.");

  context.fillStyle = PNG_EXPORT_BACKGROUND;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const image = await loadSvgImage(markup);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvasToPngBlob(canvas);
}

async function handleDiagramDownload(format) {
  if (state.editorOpen || state.downloadLoading || !cleanDiagramSvg) return;

  if (flashTimers.downloadStatus) clearTimeout(flashTimers.downloadStatus);
  const label = format.toUpperCase();
  const filename = buildDiagramFilename(format);
  setState({
    downloadLoading: true,
    downloadStatus: { text: `Preparing ${label}\u2026`, tone: null },
  });

  try {
    if (format === "svg") {
      const { markup } = getNormalizedDiagramSvg();
      const blob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
      downloadBlob(blob, filename);
    } else {
      const blob = await createDiagramPng();
      downloadBlob(blob, filename);
    }

    setState({ downloadLoading: false });
    flashStatus("downloadStatus", `${label} downloaded.`, "success");
  } catch (err) {
    console.warn(`Diagram ${format} export failed.`, err);
    setState({ downloadLoading: false });
    flashStatus(
      "downloadStatus",
      `Couldn't create the ${label} download. Please try again.`,
      "error",
    );
  }
}

let flashTimers = {};
function flashStatus(field, text, tone) {
  if (flashTimers[field]) clearTimeout(flashTimers[field]);
  setState({ [field]: { text, tone } });
  flashTimers[field] = setTimeout(() => {
    setState({ [field]: null });
  }, STATUS_MESSAGE_DURATION_MS);
}

async function init() {
  el.searchInput?.addEventListener("input", handleSearchInput);
  el.copyBtn.addEventListener("click", handleCopyClick);
  el.editBtn.addEventListener("click", handleEditClick);
  el.shareBtn.addEventListener("click", handleShareClick);
  el.downloadPngBtn.addEventListener("click", () => handleDiagramDownload("png"));
  el.downloadSvgBtn.addEventListener("click", () => handleDiagramDownload("svg"));
  el.editorInput.addEventListener("input", handleEditorInput);
  el.editorInput.addEventListener("keydown", handleEditorKeydown);
  el.editorRevertBtn.addEventListener("click", handleEditorRevert);
  el.editorCancelBtn.addEventListener("click", handleEditorCancel);
  el.editorSaveBtn.addEventListener("click", handleEditorSave);
  el.historyUndoBtn?.addEventListener("click", handleHistoryUndo);
  el.zoomOutBtn.addEventListener("click", () => {
    diagramPanzoom?.zoomOut({ animate: !prefersReducedMotion() });
  });
  el.zoomResetBtn.addEventListener("click", () => {
    diagramPanzoom?.reset({ animate: !prefersReducedMotion() });
  });
  el.zoomInBtn.addEventListener("click", () => {
    diagramPanzoom?.zoomIn({ animate: !prefersReducedMotion() });
  });

  const initial = JSON.parse(document.getElementById('workspace-data').textContent || 'null');
  const savedSvg = initial ? el.mermaidContainer.innerHTML : null;
  if (initial) await initializeWorkspace({ ...initial, svg: savedSvg });
  else if (!(await restoreFromShareUrl())) await generator?.preselect();

  const { list, corrupted } = loadHistory();
  setState({
    history: list,
    error: corrupted
      ? { scope: "history", message: "Your saved history couldn't be read, so it was reset." }
      : state.error,
  });
}

init().catch(() => setState({ error: { scope: "share", message: "The workspace could not be initialized." } }));
