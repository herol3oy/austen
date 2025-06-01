import mermaid from 'mermaid'
import { useEffect, useRef } from 'react'

import { SAMPLE_GRAPH_DEFINITION } from '@/consts/sample-graph-definition'

export const useMermaidGraph = () => {
  const graphRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const renderGraph = async () => {
      if (!graphRef.current) return

      graphRef.current.innerHTML = ''

      try {
        await mermaid.initialize({
          startOnLoad: true,
          securityLevel: 'strict',
          theme: 'forest',
        })

        const graphId = `graph_${crypto.randomUUID()}`
        const { svg } = await mermaid.render(graphId, SAMPLE_GRAPH_DEFINITION)

        graphRef.current.innerHTML = svg
      } catch (error) {
        console.error('Error rendering graph:', error)
        graphRef.current.innerHTML = `
          <div class="p-4 text-red-600">
            Failed to render graph.
          </div>`
      }
    }

    renderGraph()
  }, [])

  return graphRef
}
