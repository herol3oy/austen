import Link from 'next/link'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Discover | Austen',
  description:
    'Discover character relationship graphs created by the community',
}

export default async function DiscoverPage() {
  const supabase = await createClient()

  const { data: graphs } = await supabase
    .from('graphs')
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: false })

  return (
    <div className="container mx-auto min-h-screen p-4 py-8 md:py-12">
      <div className="mb-8 text-center">
        <h1 className="mb-4 text-4xl font-bold text-slate-800">
          Discover Graphs
        </h1>
        <p className="mx-auto max-w-2xl text-xl text-slate-600">
          Explore character relationship graphs created by book lovers from
          around the world
        </p>
      </div>

      {graphs && graphs.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {graphs.map((graph) => (
            <Link
              key={graph.id}
              href={`/share/${graph.id}`}
              className="block transition-transform hover:scale-105"
            >
              <Card className="group overflow-hidden shadow-sm transition-all hover:shadow-lg">
                <CardContent className="p-0">
                  <div
                    className="bg-muted aspect-video w-full overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: graph.svg_graph }}
                  />
                </CardContent>
                <CardHeader className="pt-4">
                  <CardTitle className="truncate text-lg group-hover:text-blue-600">
                    {graph.book_name}
                  </CardTitle>
                  <p className="text-muted-foreground text-sm">
                    by {graph.author_name || 'Unknown Author'}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Created{' '}
                    {new Date(graph.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No public graphs yet
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Be the first to share a character relationship graph with the
            community!
          </p>
        </div>
      )}
    </div>
  )
}
