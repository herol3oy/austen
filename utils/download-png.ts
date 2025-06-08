import domtoimage from 'dom-to-image'
import type { RefObject } from 'react'

import { generateGraphFileName } from '@/utils/get-graph-file-name'

export const exportGraphAsPng = async (
  graphRef: RefObject<HTMLDivElement | null>,
  title: string,
  author: string,
) => {
  if (!graphRef.current) return

  try {
    const dataUrl = await domtoimage.toPng(graphRef.current)
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `${generateGraphFileName(title, author)}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    console.error('Error generating PNG:', error)
  }
}
