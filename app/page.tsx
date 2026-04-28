'use client'

import { BookOpen, Sparkles, X } from 'lucide-react'
import Image from 'next/image'
import { useActionState, useEffect, useState } from 'react'

import { generateGraph } from '@/app/actions/generate-graph'
import { requestOpenlibBooks } from '@/app/actions/request-openlib-books'
import { GraphCard } from '@/components/GraphCard'
import { FEATURES } from '@/consts/landing-page-content'

interface Book {
  key: string
  title: string
  author_name: string
  coverImageUrl?: string
}

const MIN_SEARCH_LENGTH = 3

export default function HomePage() {
  const [state, formAction, isPending] = useActionState(generateGraph, null)

  const [searchTerm, setSearchTerm] = useState('')
  const [isSearchingOpenLib, setIsSearchingOpenLib] = useState(false)
  const [results, setResults] = useState<Book[]>([])
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [hasSubmitted, setHasSubmitted] = useState(false)

  useEffect(() => {
    if (selectedBook || searchTerm.length < MIN_SEARCH_LENGTH) return

    const debounce = setTimeout(() => {
      setIsSearchingOpenLib(true)

      requestOpenlibBooks(searchTerm)
        .then(setResults)
        .finally(() => setIsSearchingOpenLib(false))
    }, 400)

    return () => clearTimeout(debounce)
  }, [searchTerm, selectedBook])

  const handleSelectBook = (book: Book) => {
    setSelectedBook(book)
    setSearchTerm(book.title)
    setResults([])
    setHasSubmitted(false)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchTerm(value)

    if (selectedBook) {
      setSelectedBook(null)
      setHasSubmitted(false)
    }
  }

  const handleClear = () => {
    setSearchTerm('')
    setSelectedBook(null)
    setResults([])
    setHasSubmitted(false)
  }

  const handleSubmit = (formData: FormData) => {
    setHasSubmitted(true)
    formAction(formData)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-teal-50/40 to-white">
      {/* background glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-teal-200 via-cyan-200 to-emerald-200 opacity-30 blur-3xl" />

      {/* HERO */}
      <div className="mx-auto max-w-7xl px-6 py-20 text-center">
        <span className="inline-flex items-center rounded-full border border-teal-200 bg-white/80 px-4 py-2 text-sm font-medium text-teal-600 shadow-sm backdrop-blur">
          <Sparkles className="mr-2 h-4 w-4" />
          AI-Powered Character Analysis
        </span>

        <h1 className="mt-8 mb-6 text-5xl font-extrabold tracking-tight text-slate-900 md:text-7xl">
          Discover Story <br />
          <span className="bg-gradient-to-r from-teal-600 to-emerald-500 bg-clip-text text-transparent">
            Relationships
          </span>
        </h1>

        <p className="mx-auto mb-10 max-w-3xl text-xl leading-relaxed text-slate-600">
          Explore the connections between your favorite book characters through
          beautiful AI-generated relationship diagrams.
        </p>

        {/* SEARCH */}
        <div className="mx-auto max-w-3xl">
          <form action={handleSubmit} className="space-y-6">
            <div className="relative">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder={`Enter a book title (min ${MIN_SEARCH_LENGTH} characters)`}
                    value={
                      searchTerm && selectedBook
                        ? `${selectedBook.title} by ${selectedBook.author_name}`
                        : searchTerm
                    }
                    onChange={handleSearchChange}
                    className="w-full rounded-xl border border-slate-200 bg-white/80 p-4 pr-12 text-lg shadow-sm backdrop-blur transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100 focus:outline-none"
                  />

                  {searchTerm && (
                    <button
                      onClick={handleClear}
                      type="button"
                      className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-slate-100 p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!selectedBook || isPending}
                  className="rounded-xl bg-teal-600 px-6 py-4 font-semibold text-white shadow-md transition hover:bg-teal-700 hover:shadow-lg active:scale-[0.98] disabled:bg-slate-300"
                >
                  {isPending ? 'Generating...' : 'Generate'}
                </button>
              </div>

              {/* DROPDOWN */}
              {results.length > 0 && !isSearchingOpenLib && (
                <ul className="animate-in fade-in slide-in-from-top-2 absolute top-full right-0 left-0 z-10 mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white/95 shadow-xl backdrop-blur">
                  {results.map((book) => (
                    <li
                      key={book.key}
                      onClick={() => handleSelectBook(book)}
                      className="flex cursor-pointer items-center gap-4 p-4 transition-colors hover:bg-teal-50"
                    >
                      {book.coverImageUrl && (
                        <Image
                          src={book.coverImageUrl}
                          alt={book.title}
                          width={40}
                          height={60}
                          className="rounded border border-slate-200 object-cover"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-800">
                          {book.title}
                        </div>
                        <div className="truncate text-sm text-slate-500">
                          {book.author_name}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {isSearchingOpenLib && (
                <div className="mt-3 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
                    Searching books...
                  </span>
                </div>
              )}
            </div>

            <input
              type="hidden"
              name="title"
              value={selectedBook?.title || ''}
            />
            <input
              type="hidden"
              name="author"
              value={selectedBook?.author_name || ''}
            />

            {state?.error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
                {state.error}
              </div>
            )}
          </form>

          {isPending && hasSubmitted && (
            <div className="mt-6 inline-flex items-center gap-3 rounded-xl border border-teal-100 bg-teal-50 px-6 py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
              Generating graph...
            </div>
          )}

          {state?.mermaidSyntax &&
            selectedBook &&
            hasSubmitted &&
            !isPending && (
              <GraphCard
                graphDefinition={state.mermaidSyntax}
                emojis={state.emojis}
                title={selectedBook.title}
                author={selectedBook.author_name}
                coverImageUrl={selectedBook.coverImageUrl}
              />
            )}
        </div>
      </div>

      {/* SAMPLE */}
      <div className="mx-auto max-w-5xl px-6">
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)]">
          <div className="mb-4 flex justify-center text-sm text-slate-500">
            <BookOpen className="mr-2 h-4 w-4" />
            Sample: Sense and Sensibility
          </div>

          <Image
            src="/austen-pages.dev-sense-and-sensibility-jane-austen-graph.svg"
            width={720}
            height={540}
            alt="graph"
            className="mx-auto"
          />
        </div>
      </div>

      {/* FEATURES */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="mb-12 text-center text-4xl font-bold text-slate-900">
            Powerful Features
          </h2>

          <div className="grid gap-8 md:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl bg-white p-6 shadow-sm transition hover:shadow-xl"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white">
                  <f.icon />
                </div>
                <h3 className="mb-2 font-semibold text-slate-800">{f.title}</h3>
                <p className="text-slate-600">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 text-center text-slate-500">
        <div className="mb-6 h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        © 2025 Austen
      </footer>
    </div>
  )
}
