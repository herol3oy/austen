import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function DashboardLoading() {
  return (
    <div className="container mx-auto p-4">
      <div className="mb-6 h-8 w-48 animate-pulse rounded-md bg-gray-200" />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="relative transition-shadow hover:shadow-lg">
            <CardHeader>
              <div className="mb-2 h-6 w-3/4 animate-pulse rounded-md bg-gray-200" />
              <div className="h-4 w-1/2 animate-pulse rounded-md bg-gray-100" />
            </CardHeader>
            <CardContent>
              <div className="bg-muted h-48 w-full animate-pulse rounded-md" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
