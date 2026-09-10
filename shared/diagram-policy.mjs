export const VALIDATOR_VERSION = '1';
export const MAX_GRAPH_LENGTH = 12000;
export function sanitizeMermaid(raw) {
  return typeof raw === 'string' ? raw.trim().replace(/^```(?:mermaid)?\s*/i, '').replace(/```\s*$/i, '').trim() : '';
}

// A deliberately small, reviewable flowchart grammar. No Mermaid directives or HTML.
// Implicit labels are accepted for legacy shares; the prompt requests explicit labels.
export function validateDiagram(raw, { legacy = false } = {}) {
  const source = sanitizeMermaid(raw);
  if (!source || source.length > MAX_GRAPH_LENGTH) throw new Error('Graph is empty or exceeds 12,000 characters');
  if (/[<>]/.test(source.replace(/-->/g, '')) || /[{};`\\]|%%|(?:https?:|javascript:|data:)|[\u0000-\u0008\u000b-\u001f]/i.test(source)) throw new Error('Graph contains unsupported markup or directives');
  const lines = source.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const direction = lines.shift();
  if (legacy ? !/^graph (?:LR|RL|TD|TB|BT)$/.test(direction) : direction !== 'graph LR') throw new Error('Use graph LR');
  const node = '([A-Za-z][A-Za-z0-9_]{0,63})(?:\\[(?:"[^"\\[\\]<>|]{1,100}"|[^"\\[\\]<>|]{1,100})\\])?';
  const declaration = new RegExp(`^${node}$`, 'u');
  const edge = new RegExp(`^${node}\\s*-->\\s*(?:\\|([^|<>]{1,80})\\|\\s*)?${node}$`, 'u');
  const nodes = new Set(); let edges = 0;
  for (const line of lines) {
    const match = line.match(edge);
    if (match) { nodes.add(match[1]); nodes.add(match[3]); edges++; }
    else { const match = line.match(declaration); if (!match) throw new Error('Use one character declaration or directional relationship per line'); nodes.add(match[1]); }
  }
  if (nodes.size < 2 || nodes.size > 20 || edges < 1 || edges > 40) throw new Error('Graph must have 2–20 characters and 1–40 relationships');
  return { source, characters: nodes.size, edges };
}
