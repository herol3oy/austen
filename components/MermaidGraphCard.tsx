'use client'

// eslint-disable-next-line simple-import-sort/imports
import Prism from 'prismjs'
import 'prismjs/components/prism-mermaid'
import 'prismjs/themes/prism-coy.min.css'

import domtoimage from 'dom-to-image'
import mermaid from 'mermaid'
import { useEffect, useRef, useState } from 'react'

import { Button } from './ui/button'

interface MermaidGraphProps {
  graphDefinition: string
  emojis: string
  title: string
  author: string
}

export function MermaidGraphCard({
  graphDefinition,
  emojis,
  title,
  author,
}: MermaidGraphProps) {
  const graphRef = useRef<HTMLDivElement>(null)
  const codeRef = useRef<HTMLElement>(null)
  const [svgContent, setSvgContent] = useState<string>('')

  const getFileName = () => {
    return `austen-pages.dev-${title?.toLowerCase().replace(/\s+/g, '-')}-${author?.toLowerCase().replace(/\s+/g, '-')}-graph`
  }

  const downloadSvg = () => {
    if (!svgContent) return

    const blob = new Blob([svgContent], { type: 'image/svg+xml' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${getFileName()}.svg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  const downloadPng = async () => {
    if (!graphRef.current) return

    try {
      const dataUrl = await domtoimage.toPng(graphRef.current)
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `${getFileName()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error generating PNG:', error)
    }
  }

  useEffect(() => {
    const renderGraph = async () => {
      if (graphRef.current) {
        graphRef.current.innerHTML = ''

        try {
          await mermaid.initialize({
            startOnLoad: true,
            securityLevel: 'strict',
            theme: 'forest',
            look: 'handDrawn',
          })

          const graphId = `graph_${crypto.randomUUID()}`
          const { svg } = await mermaid.render(graphId, graphDefinition)

          graphRef.current.innerHTML = svg
          setSvgContent(svg)
        } catch (error) {
          console.error('Error rendering graph:', error)
          graphRef.current.innerHTML = `
            <div class="p-4 text-red-600">
              Failed to render graph. Please check the syntax.
            </div>`
        }
      }
    }

    renderGraph()
  }, [graphDefinition])

  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current)
    }
  }, [graphDefinition])

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow">
      <div className="mb-4 border-b pb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-gray-600">by {author}</p>
      </div>

      <div className="space-y-4">
        <div>
          <div ref={graphRef} />
          <div className="ml-4 flex gap-2">
            {svgContent && (
              <>
                <Button onClick={downloadSvg}>Download SVG</Button>
                <Button onClick={downloadPng}>Download PNG</Button>
              </>
            )}
          </div>
        </div>

        <h3 className="mb-2 text-sm font-medium text-gray-500">
          Mermaid Syntax:
        </h3>
        <pre className="overflow-x-auto rounded bg-gray-50 p-4 text-sm">
          <code ref={codeRef} className="language-mermaid">
            {graphDefinition}
          </code>
        </pre>

        {emojis && (
          <div className="border-t pt-4">
            <h3 className="mb-2 text-sm font-medium text-gray-500">
              Related Emojis:
            </h3>
            <div className="text-2xl">{emojis}</div>
          </div>
        )}
      </div>
    </div>
  )
}
