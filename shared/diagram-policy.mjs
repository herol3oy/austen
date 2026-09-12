export const VALIDATOR_VERSION = '1';
export const MAX_GRAPH_LENGTH = 12000;
export function sanitizeMermaid(raw) {
  return typeof raw === 'string' ? raw.trim().replace(/^```(?:mermaid)?\s*/i, '').replace(/```\s*$/i, '').trim() : '';
}

// A deliberately small, reviewable flowchart grammar. No Mermaid directives or HTML.
// Implicit labels are accepted for legacy shares; the prompt requests explicit labels.
export function parseDiagram(raw, { legacy = false } = {}) {
  const source = sanitizeMermaid(raw);
  if (!source || source.length > MAX_GRAPH_LENGTH) throw new Error('Graph is empty or exceeds 12,000 characters');
  if (/[<>]/.test(source.replace(/-->/g, '')) || /[{};`\\]|%%|(?:https?:|javascript:|data:)|[\u0000-\u0008\u000b-\u001f]/i.test(source)) throw new Error('Graph contains unsupported markup or directives');
  const lines = source.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const direction = lines.shift();
  if (legacy ? !/^graph (?:LR|RL|TD|TB|BT)$/.test(direction) : direction !== 'graph LR') throw new Error('Use graph LR');
  const node = '([A-Za-z][A-Za-z0-9_]{0,63})(?:\\[("[^"\\[\\]<>|]{1,100}"|[^"\\[\\]<>|]{1,100})\\])?';
  const declaration = new RegExp(`^${node}$`, 'u');
  const edge = new RegExp(`^${node}\\s*-->\\s*(?:\\|([^|<>]{1,80})\\|\\s*)?${node}$`, 'u');
  /** @type {Map<string, { id: string, label: string }>} */
  const nodes = new Map();
  /** @type {{ source: string, target: string, label: string | null }[]} */
  const edges = [];
  function addNode(id, label) {
    // References never overwrite a name; a later explicit label does.
    if (label !== undefined) nodes.set(id, { id, label: label.replace(/^"|"$/g, '').trim() || id });
    else if (!nodes.has(id)) nodes.set(id, { id, label: id });
  }
  for (const line of lines) {
    const match = line.match(edge);
    if (match) {
      addNode(match[1], match[2]); addNode(match[4], match[5]);
      edges.push({ source: match[1], target: match[4], label: match[3]?.trim() || null });
    } else {
      const match = line.match(declaration);
      if (!match) throw new Error('Use one character declaration or directional relationship per line');
      addNode(match[1], match[2]);
    }
  }
  if (nodes.size < 2 || nodes.size > 20 || edges.length < 1 || edges.length > 40) throw new Error('Graph must have 2–20 characters and 1–40 relationships');
  return { source, nodes: [...nodes.values()], edges };
}

export function validateDiagram(raw, options = {}) {
  const { source, nodes, edges } = parseDiagram(raw, options);
  return { source, characters: nodes.length, edges: edges.length };
}
