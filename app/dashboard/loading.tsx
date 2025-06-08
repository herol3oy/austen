import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function DashboardLoading() {
  return (
    <div className="container mx-auto p-4 py-8 md:py-12">
      <div className="mb-10 space-y-2">
        <div className="h-10 w-1/3 animate-pulse rounded-md bg-gray-200"></div>
        <div className="h-6 w-1/2 animate-pulse rounded-md bg-gray-200"></div>
      </div>
      <div className="mb-12 grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <div className="h-7 w-3/5 animate-pulse rounded-md bg-gray-200"></div>
          </CardHeader>
          <CardContent className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i}>
                <div className="mb-1 h-4 w-1/4 animate-pulse rounded-md bg-gray-200"></div>
                <div className="h-5 w-3/4 animate-pulse rounded-md bg-gray-200"></div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader>
            <div className="h-7 w-2/5 animate-pulse rounded-md bg-gray-200"></div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="rounded-lg border bg-gray-50 p-4">
                  <div className="mb-2 h-4 w-3/4 animate-pulse rounded-md bg-gray-200"></div>
                  <div className="h-8 w-1/2 animate-pulse rounded-md bg-gray-200"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <div>
        <div className="mb-6 h-8 w-1/4 animate-pulse rounded-md bg-gray-200"></div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="h-full overflow-hidden shadow-sm">
              <CardContent className="p-0">
                <div className="aspect-video w-full animate-pulse bg-gray-200"></div>
              </CardContent>
              <CardHeader className="pt-4">
                <div className="mb-2 h-6 w-3/4 animate-pulse rounded-md bg-gray-200"></div>
                <div className="h-4 w-1/2 animate-pulse rounded-md bg-gray-200"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
