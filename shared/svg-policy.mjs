const elements = new Set(['svg', 'g', 'defs', 'style', 'marker', 'path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line', 'text', 'tspan', 'title', 'desc', 'clippath', 'filter', 'fedropshadow', 'lineargradient', 'stop']);
export function checkSvgElements(nodes) {
  if (nodes[0]?.name.toLowerCase() !== 'svg') throw new Error('Expected SVG root');
  for (const node of nodes) {
    if (!elements.has(node.name.toLowerCase())) throw new Error(`Unsupported SVG element: ${node.name}`);
    for (const [key, value] of Object.entries(node.attributes)) {
      if (/^on/i.test(key) || /^(?:href|xlink:href|src)$/i.test(key) || /[\\]|@import|expression\s*\(|javascript:|data:|https?:|\/\//i.test(value.replace(/http:\/\/www\.w3\.org\/2000\/svg|http:\/\/www\.w3\.org\/1999\/xlink/g, ''))) throw new Error('Unsafe SVG attribute');
      checkCss(value);
    }
    if (node.name.toLowerCase() === 'style') checkCss(node.text);
  }
  const viewBox = (nodes[0].attributes.viewBox || '').trim().split(/[\s,]+/).map(Number);
  if (viewBox.length !== 4 || viewBox.some(n => !Number.isFinite(n)) || viewBox[2] <= 0 || viewBox[3] <= 0 || viewBox[2] > 20000 || viewBox[3] > 20000) throw new Error('Invalid SVG dimensions');
  return { width: viewBox[2], height: viewBox[3] };
}
function checkCss(value = '') {
  if (/[\\]|@(?!keyframes\b)|expression\s*\(|javascript:|data:|https?:|\/\*/i.test(value)) {
    // Namespace attributes are checked separately and contain no CSS.
    if (/^http:\/\/www\.w3\.org\/(?:2000\/svg|1999\/xlink)$/.test(value)) return;
    throw new Error('Unsafe SVG style');
  }
  for (const match of value.matchAll(/url\s*\(([^)]*)\)/gi)) if (!/^['"]?#[a-z0-9_-]+['"]?$/i.test(match[1].trim())) throw new Error('External SVG reference');
}
export function checkSvgEnvelope(svg) {
  if (typeof svg !== 'string' || svg.length > 1000000 || !/^\s*<svg[\s>]/.test(svg) || /<!|<\?/.test(svg)) throw new Error('Invalid SVG document');
}
