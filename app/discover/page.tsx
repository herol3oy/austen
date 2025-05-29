'use client'

import { useEffect, useState } from 'react'

import { MermaidGraphCard } from '@/components/MermaidGraphCard'
import { createClient } from '@/lib/supabase/client'

interface StoredGraph {
  id: string
  book_name: string
  author_name: string
  mermaid_syntax: string
  emojis: string
  is_public: boolean
  created_at: string
  user_id: string
}

export default function DiscoverPage() {
  const [graphs, setGraphs] = useState<StoredGraph[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPublicGraphs = async () => {
      const supabase = createClient()
      try {
        const { data, error } = await supabase
          .from('graphs')
          .select('*')
          .eq('is_public', true)
          .order('created_at', { ascending: false })

        if (error) throw error
        setGraphs(data || [])
      } catch (error) {
        console.error('Error fetching public graphs:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPublicGraphs()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Discover Public Graphs</h1>
        <p className="mt-2 text-gray-600">
          Explore relationship graphs shared by the community
        </p>
      </div>

      {graphs.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
          <p className="text-lg text-gray-500">
            No public graphs available yet.
          </p>
          <p className="mt-2 text-sm text-gray-400">
            Create a graph and make it public to be the first to share!
          </p>
        </div>
      ) : (
        <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-2">
          {graphs.map((graph) => (
            <div key={graph.id}>
              <MermaidGraphCard
                graphId={graph.id}
                title={graph.book_name}
                author={graph.author_name}
                graphDefinition={graph.mermaid_syntax}
                emojis={graph.emojis}
                isPublic={graph.is_public}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
