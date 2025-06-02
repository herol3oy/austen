import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function ShareLoading() {
  return (
    <Card>
      <CardHeader>
        <div className="mb-3 h-7 w-3/4 animate-pulse rounded-md bg-gray-200" />
        <div className="flex items-center gap-2">
          <div className="h-5 w-8 animate-pulse rounded-md bg-gray-100" />
          <div className="h-5 w-1/3 animate-pulse rounded-md bg-gray-100" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="min-h-[400px] w-full animate-pulse rounded-lg bg-gray-100" />
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="h-10 w-32 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-10 w-32 animate-pulse rounded-lg bg-gray-200" />
        </div>
      </CardContent>
    </Card>
  )
}
