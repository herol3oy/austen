export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-50">
      <div className="relative overflow-hidden">
        <div className="relative px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-8 h-12 w-3/4 animate-pulse rounded-lg bg-gray-200 md:w-1/2" />
            <div className="mx-auto mb-8 h-24 w-2/3 animate-pulse rounded-lg bg-gray-100" />

            <div className="mt-10 flex items-center justify-center gap-4">
              <div className="h-12 w-32 animate-pulse rounded-lg bg-gray-200" />
              <div className="h-12 w-32 animate-pulse rounded-lg bg-gray-200" />
            </div>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-5xl px-6 lg:px-8">
          <div className="h-[400px] w-full animate-pulse rounded-2xl bg-gray-100 shadow-2xl" />
        </div>
      </div>
    </div>
  )
}
