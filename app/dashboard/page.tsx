import { formatDistanceToNow } from 'date-fns'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { DeleteGraphDialog } from '@/components/DeleteGraphDialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: graphs } = await supabase
    .from('graphs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="container mx-auto p-4">
      <h1 className="mb-6 text-2xl font-bold">Your Saved Graphs</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {graphs?.map((graph) => (
          <Link key={graph.id} href={`/share/${graph.id}`}>
            <Card className="relative transition-shadow hover:shadow-lg">
              <CardHeader>
                <CardTitle>{graph.book_name}</CardTitle>
                <p className="text-muted-foreground text-sm">
                  Created {formatDistanceToNow(new Date(graph.created_at))} ago
                </p>
              </CardHeader>
              <CardContent>
                <div
                  className="bg-muted h-48 w-full overflow-hidden rounded-md"
                  dangerouslySetInnerHTML={{ __html: graph.svg_graph }}
                />
              </CardContent>
              <DeleteGraphDialog
                graphId={graph.id}
                graphTitle={graph.book_name}
              />
            </Card>
          </Link>
        ))}

        {!graphs?.length && (
          <div className="col-span-full py-12 text-center">
            <p className="text-muted-foreground mb-6">
              No graphs yet! Start by creating your first graph.
            </p>
            <Link href="/create">
              <button className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none">
                <Plus className="h-4 w-4" />
                Create New Graph
              </button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
