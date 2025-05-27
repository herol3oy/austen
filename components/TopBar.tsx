import Link from 'next/link'

export default function TopBar() {
  return (
    <div className="flex items-center justify-between p-4">
      <div>
        <Link href="/">
          <h1 className="text-xl font-bold">Austen</h1>
        </Link>
        <small>Discover Story Relationships</small>
      </div>
      <nav className="space-x-4">
        <Link
          href="https://github.com/herol3oy/austen"
          target="_blank"
          className="hover:underline"
        >
          Github
        </Link>
        <Link href="/login" className="hover:underline">
          Login
        </Link>
      </nav>
    </div>
  )
}
