import { getFileName } from '@/utils/get-graph-file-name'

export const downloadSvg = (
  svgContent: string,
  title: string,
  author: string,
) => {
  if (!svgContent) return

  const blob = new Blob([svgContent], { type: 'image/svg+xml' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${getFileName(title, author)}.svg`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}
