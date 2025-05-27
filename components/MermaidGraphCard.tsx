'use client'

// eslint-disable-next-line simple-import-sort/imports
import Prism from 'prismjs'
import 'prismjs/components/prism-mermaid'
import 'prismjs/themes/prism-coy.min.css'

import mermaid from 'mermaid'
import { useEffect, useRef } from 'react'

interface MermaidGraphProps {
  graphDefinition: string
  emojis: string
}

export function MermaidGraphCard({
  graphDefinition,
  emojis,
}: MermaidGraphProps) {
  const graphRef = useRef<HTMLDivElement>(null)
  const codeRef = useRef<HTMLElement>(null)

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
      <div className="space-y-4">
        <div ref={graphRef} className="overflow-x-auto" />

        <div className="border-t pt-4">
          <h3 className="mb-2 text-sm font-medium text-gray-500">
            Mermaid Syntax:
          </h3>
          <pre className="overflow-x-auto rounded bg-gray-50 p-4 text-sm">
            <code ref={codeRef} className="language-mermaid">
              {graphDefinition}
            </code>
          </pre>
        </div>

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
