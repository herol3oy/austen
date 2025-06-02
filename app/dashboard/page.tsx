import { formatDistanceToNow } from 'date-fns'
import { Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

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

  const { data: userGraphs } = await supabase
    .from('graphs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const username =
    user.user_metadata?.username || user.email?.split('@')[0] || 'User'

  const publicGraphCount = userGraphs?.filter((g) => g.is_public).length || 0
  const privateGraphCount = userGraphs?.filter((g) => !g.is_public).length || 0

  return (
    <div className="container mx-auto p-4 py-8 md:py-12">
      <div className="mb-10 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          {username}&apos;s Profile
        </h1>
        <p className="text-muted-foreground text-lg">
          View your profile information and manage all your graphs.
        </p>
      </div>

      <div className="mb-12 grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Profile Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Username</h3>
              <p className="mt-1 text-lg font-semibold text-gray-800">
                {username}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Email</h3>
              <p className="mt-1 text-gray-700">{user.email}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">
                Account Created
              </h3>
              <p className="mt-1 text-gray-700">
                {user.created_at
                  ? formatDistanceToNow(new Date(user.created_at), {
                      addSuffix: true,
                    })
                  : 'Unknown'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Graph Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg border bg-gray-50 p-4">
                <h3 className="text-sm font-medium text-gray-500">
                  Total Graphs
                </h3>
                <p className="mt-1 text-3xl font-bold text-gray-800">
                  {userGraphs?.length || 0}
                </p>
              </div>
              <div className="rounded-lg border bg-gray-50 p-4">
                <h3 className="text-sm font-medium text-gray-500">
                  Public Graphs
                </h3>
                <p className="mt-1 text-3xl font-bold text-gray-800">
                  {publicGraphCount}
                </p>
              </div>
              <div className="rounded-lg border bg-gray-50 p-4">
                <h3 className="text-sm font-medium text-gray-500">
                  Private Graphs
                </h3>
                <p className="mt-1 text-3xl font-bold text-gray-800">
                  {privateGraphCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-6 text-2xl font-bold">Your Graphs</h2>
        {userGraphs && userGraphs.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {userGraphs.map((graph) => (
              <Card
                key={graph.id}
                className="group flex h-full flex-col overflow-hidden shadow-sm transition-all hover:shadow-lg"
              >
                <Link href={`/share/${graph.id}`} className="block flex-grow">
                  <CardContent className="p-0">
                    <div
                      className="bg-muted aspect-video w-full overflow-hidden transition-transform group-hover:scale-105"
                      dangerouslySetInnerHTML={{ __html: graph.svg_graph }}
                    />
                  </CardContent>
                </Link>
                <CardHeader className="pt-4">
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/share/${graph.id}`}
                      className="block truncate"
                    >
                      <CardTitle className="truncate text-lg group-hover:text-blue-600">
                        {graph.book_name}
                      </CardTitle>
                    </Link>
                    {graph.is_public ? (
                      <span
                        title="Public"
                        className="ml-2 flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
                      >
                        <Eye className="mr-1 h-3 w-3" /> Public
                      </span>
                    ) : (
                      <span
                        title="Private"
                        className="ml-2 flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800"
                      >
                        <EyeOff className="mr-1 h-3 w-3" /> Private
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    by {graph.author_name || 'Unknown Author'} - Created{' '}
                    {formatDistanceToNow(new Date(graph.created_at))} ago
                  </p>
                </CardHeader>
              </Card>
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
              No graphs created yet
            </h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Get started by creating your first character relationship graph.
            </p>
            <div className="mt-6">
              <Link href="/create">
                <button
                  type="button"
                  className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
                >
                  Create New Graph
                </button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
