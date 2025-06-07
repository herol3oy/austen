import { formatDistanceToNow } from 'date-fns'
import { redirect } from 'next/navigation'

import { Card } from '@/components/ui/card'
import { CardContent } from '@/components/ui/card'
import { CardHeader } from '@/components/ui/card'
import { CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/server'

export default async function ProfilePage() {
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

  const publicGraphCount = userGraphs?.filter((g) => g.is_public).length || 0
  const privateGraphCount = userGraphs?.filter((g) => !g.is_public).length || 0
  const username =
    user.user_metadata?.username || user.email?.split('@')[0] || 'User'

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const shareUrl = username ? `${baseUrl}/profile/${username}` : ''

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
            <div>
              <h3 className="text-sm font-medium text-gray-500">
                Share Your Profile URL
              </h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Your public profile can be accessed via this URL:
              </p>
              <Input
                readOnly
                value={shareUrl}
                className="mt-2 w-full cursor-default rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-700 shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
                placeholder={username ? 'Profile URL' : 'Username not found'}
              />
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
    </div>
  )
}
