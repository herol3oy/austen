import config from './mermaid.config.json' with { type: 'json' }

const theme = config.themeVariables
export const DIAGRAM_BACKGROUND = theme.edgeLabelBackground

// Published SVGs remain immutable. Adapt the previous palette only in their
// presentation, using the same colors as newly rendered diagrams.
const legacyColors = new Map([
	['#ece6d9', theme.primaryColor],
	['#282722', theme.primaryTextColor],
	['#40584b', theme.primaryBorderColor],
	['#727066', theme.lineColor],
	['#f5f1e8', theme.secondaryColor],
	['#fbf9f4', theme.tertiaryColor],
	['#04060b', theme.primaryTextColor],
	['#0b0b0b', theme.lineColor],
])
const surfaceRgb = DIAGRAM_BACKGROUND.slice(1)
	.match(/../g)
	.map((channel) => Number.parseInt(channel, 16))
	.join(', ')

function recolor(value) {
	// A local reference can resemble a hex color; never rewrite IDs.
	return value.replace(
		/url\([^)]*\)|#[a-f\d]{3,8}\b|rgba\(\s*251\s*,\s*249\s*,\s*244\s*,/gi,
		(color) => {
			if (color.toLowerCase().startsWith('rgba(')) return `rgba(${surfaceRgb},`
			return legacyColors.get(color.toLowerCase()) ?? color
		},
	)
}

function themeDeclarations(css) {
	return css.replace(
		/((?:^|[;{])\s*(?:fill|stroke|color|background(?:-color)?|stop-color)\s*:\s*)([^;{}]+)/gi,
		(_match, property, value) => property + recolor(value),
	)
}

// Input must have passed the existing SVG validation. This is a color
// transformation, not a sanitizer. Labels and all structural markup stay intact.
export function themeDiagramSvg(svg) {
	return svg.replace(
		/<style\b[^>]*>[\s\S]*?<\/style\s*>|<[a-z](?:"[^"]*"|'[^']*'|[^'">])*>/gi,
		(tag) => {
			if (/^<style\b/i.test(tag))
				return tag.replace(
					/^(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)$/i,
					(_match, open, css, close) => open + themeDeclarations(css) + close,
				)
			return tag.replace(
				/(\s)([\w:-]+)(\s*=\s*)(["'])([\s\S]*?)\4/g,
				(match, space, name, equals, quote, value) => {
					if (name.toLowerCase() === 'style')
						return (
							space + name + equals + quote + themeDeclarations(value) + quote
						)
					if (/^(?:fill|stroke|color|stop-color)$/i.test(name))
						return space + name + equals + quote + recolor(value) + quote
					return match
				},
			)
		},
	)
}
