import { createHighlighter } from 'shiki'

export const highlighter = await createHighlighter({
  themes: ['light-plus'],
  langs: ['mermaid'],
})
