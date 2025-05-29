import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { DeleteGraphDialog } from '@/components/delete-graph-dialog'
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
          <div className="text-muted-foreground col-span-full py-12 text-center">
            No graph! Start by creating a new graph!
          </div>
        )}
      </div>
    </div>
  )
}
