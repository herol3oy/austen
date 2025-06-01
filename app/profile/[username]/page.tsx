import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

export default async function ProfilePage({
  params,
}: {
  params: {
    username: string
  }
}) {
  const supabase = await createClient()
  const { username: profileUsername } = params

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, updated_at')
    .eq('username', profileUsername)
    .single()

  if (profileError || !profile) {
    notFound()
  }

  const { data: publicGraphs } = await supabase
    .from('graphs')
    .select('*')
    .eq('user_id', profile.id)
    .eq('is_public', true)
    .order('created_at', { ascending: false })

  const {
    data: { user: loggedInUser },
  } = await supabase.auth.getUser()
  const isOwnProfile = loggedInUser?.id === profile.id

  const { data: allUserGraphs } = await supabase
    .from('graphs')
    .select('id')
    .eq('user_id', profile.id)

  return (
    <div className="container mx-auto p-4 py-8 md:py-12">
      <div className="mb-10 flex flex-col items-center space-y-4 md:flex-row md:space-y-0 md:space-x-6">
        <Avatar className="border-primary h-24 w-24 border-2 md:h-32 md:w-32">
          <AvatarFallback className="text-4xl md:text-5xl">
            {profile.username.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            {profile.username}
          </h1>
          <p className="text-muted-foreground text-lg">
            Public profile and graphs.
          </p>
          {isOwnProfile && (
            <Link
              href="/dashboard"
              className="mt-1 inline-block text-sm text-blue-600 hover:underline"
            >
              Manage your graphs (Dashboard)
            </Link>
          )}
        </div>
      </div>

      <div className="mb-12 grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">User Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Username</h3>
              <p className="mt-1 text-lg font-semibold text-gray-800">
                {profile.username}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">
                Profile Updated
              </h3>
              <p className="mt-1 text-gray-700">
                {profile.updated_at
                  ? formatDistanceToNow(new Date(profile.updated_at), {
                      addSuffix: true,
                    })
                  : 'N/A'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Graph Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="rounded-lg border bg-gray-50 p-4">
                <h3 className="text-sm font-medium text-gray-500">
                  Total Graphs
                </h3>
                <p className="mt-1 text-3xl font-bold text-gray-800">
                  {allUserGraphs?.length || 0}
                </p>
              </div>
              <div className="rounded-lg border bg-gray-50 p-4">
                <h3 className="text-sm font-medium text-gray-500">
                  Public Graphs
                </h3>
                <p className="mt-1 text-3xl font-bold text-gray-800">
                  {publicGraphs?.length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-6 text-2xl font-bold">
          Public Graphs by {profile.username}
        </h2>
        {publicGraphs && publicGraphs.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {publicGraphs.map((graph) => (
              <Link key={graph.id} href={`/share/${graph.id}`}>
                <Card className="group h-full overflow-hidden shadow-sm transition-all hover:shadow-lg">
                  <CardContent className="p-0">
                    <div
                      className="bg-muted aspect-video w-full overflow-hidden transition-transform group-hover:scale-105"
                      dangerouslySetInnerHTML={{ __html: graph.svg_graph }}
                    />
                  </CardContent>
                  <CardHeader className="pt-4">
                    <CardTitle className="truncate text-lg group-hover:text-blue-600">
                      {graph.book_name}
                    </CardTitle>
                    <p className="text-muted-foreground text-xs">
                      Created {formatDistanceToNow(new Date(graph.created_at))}{' '}
                      ago
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
              No public graphs
            </h3>
            <p className="text-muted-foreground mt-1 text-sm">
              {profile.username} hasn&apos;t made any of their graphs public
              yet.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
