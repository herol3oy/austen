export const generateGraphFileName = (
  title = 'untitled',
  author = 'unknown',
) => {
  return `austen-pages.dev-${title.toLowerCase().replace(/\s+/g, '-')}-${author.toLowerCase().replace(/\s+/g, '-')}-graph`
}
