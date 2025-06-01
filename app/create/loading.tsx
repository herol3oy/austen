export default function CreateLoading() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 relative z-10 mx-auto max-w-7xl px-6 py-20 text-center duration-1000">
      <div className="mb-12 text-center">
        <div className="mb-8">
          <div className="inline-flex h-9 w-48 animate-pulse items-center rounded-full bg-gray-200" />
        </div>
        <div className="mx-auto mb-6 h-16 w-3/4 animate-pulse rounded-lg bg-gray-200 md:w-1/2" />
        <div className="mx-auto mb-8 h-12 w-2/3 animate-pulse rounded-lg bg-gray-100 md:w-1/3" />
        <div className="relative mx-auto w-full max-w-4xl">
          <div className="relative">
            <div className="h-16 w-full animate-pulse rounded-2xl bg-gray-200 sm:h-20" />
          </div>
        </div>
      </div>
      <div className="mt-12">
        <div className="min-h-[400px] w-full animate-pulse rounded-lg bg-gray-100" />
      </div>
    </div>
  )
}
