'use client'

import { X } from 'lucide-react'
import Image from 'next/image'
import { useActionState, useEffect, useState } from 'react'

import { generateGraph } from '@/app/actions/generate-graph'
import { requestOpenlibBooks } from '@/app/actions/request-openlib-books'
import { GraphCard } from '@/components/GraphCard'

interface Book {
  key: string
  title: string
  author_name: string
  coverImageUrl?: string
}

const MIN_SEARCH_LENGTH = 3
const MAX_SEARCH_LENGTH = 100

export default function Home() {
  const [state, formAction, isPending] = useActionState(generateGraph, null)

  const [searchTerm, setSearchTerm] = useState('')
  const [isSearchingOpenLib, setIsSearchingOpenLib] = useState(false)
  const [results, setResults] = useState<Book[]>([])
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [hasSubmitted, setHasSubmitted] = useState(false)

  useEffect(() => {
    if (selectedBook) return

    if (searchTerm.length < MIN_SEARCH_LENGTH) {
      setResults([])
      return
    }

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
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-8 text-center text-4xl font-bold">
        Book Graph Generator
      </h1>

      <form action={handleSubmit} className="space-y-6">
        <div className="relative">
          <div className="flex flex-col sm:flex-row">
            <div className="relative w-full sm:flex-1">
              <input
                type="text"
                placeholder={`Enter a book title (min ${MIN_SEARCH_LENGTH} characters)`}
                value={
                  searchTerm && selectedBook
                    ? `${selectedBook.title} by ${selectedBook.author_name}`
                    : searchTerm
                }
                onChange={handleSearchChange}
                minLength={MIN_SEARCH_LENGTH}
                maxLength={MAX_SEARCH_LENGTH}
                className="w-full rounded-lg border-2 border-gray-300 p-3 pr-10 text-lg focus:border-blue-500 focus:outline-none sm:rounded-l-lg sm:rounded-r-none sm:p-4 sm:pr-12 sm:text-xl"
              />

              {searchTerm && (
                <button
                  onClick={handleClear}
                  type="button"
                  className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-gray-100 p-2 text-gray-400 transition-all duration-200 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  <X size={24} className="sm:h-6 sm:w-6" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={!selectedBook || isPending}
              className="mt-2 rounded-lg border-2 border-t-0 border-blue-600 bg-blue-600 px-4 py-3 text-lg font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:border-gray-400 disabled:bg-gray-400 sm:mt-0 sm:rounded-l-none sm:rounded-r-lg sm:border-t-2 sm:border-l-0 sm:px-8 sm:py-4 sm:text-xl"
            >
              {isPending ? 'Generating...' : 'Generate'}
            </button>
          </div>

          {results.length > 0 && !isSearchingOpenLib && (
            <ul className="absolute top-full right-0 left-0 z-10 max-h-60 overflow-y-auto rounded-b-lg border-2 border-t-0 border-gray-300 bg-white shadow-lg">
              {results.map((book) => (
                <li
                  key={book.key}
                  onClick={() => handleSelectBook(book)}
                  className="flex cursor-pointer items-center gap-4 border-b border-gray-200 p-4 last:border-b-0 hover:bg-gray-100"
                >
                  {book.coverImageUrl && (
                    <Image
                      className="h-15 w-10 rounded border border-gray-200 object-cover"
                      src={book.coverImageUrl}
                      alt={`Cover of ${book.title}`}
                      width={40}
                      height={60}
                      placeholder="blur"
                      blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mM89R8AApkBy17XrZoAAAAASUVORK5CYII="
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-lg font-bold">
                      {book.title}
                    </div>
                    <div className="truncate text-gray-600">
                      by {book.author_name}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {isSearchingOpenLib && (
            <div className="mt-2 text-center text-gray-500">
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></span>
                <span>Searching books...</span>
              </span>
            </div>
          )}
        </div>

        <input type="hidden" name="title" value={selectedBook?.title || ''} />
        <input
          type="hidden"
          name="author"
          value={selectedBook?.author_name || ''}
        />

        {state?.error && (
          <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4">
            <p className="font-bold text-red-700">Error: {state.error}</p>
          </div>
        )}
      </form>

      {!searchTerm && !selectedBook && !hasSubmitted && (
        <p className="mt-4 text-center text-lg text-gray-500 italic">
          Start to type a title of a book to start your journey
        </p>
      )}

      {isPending && (
        <p className="text-lg font-medium text-yellow-700">
          Generating graph for {selectedBook?.title}...
        </p>
      )}

      {isPending && hasSubmitted && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center gap-3 rounded-lg border-2 border-yellow-200 bg-yellow-50 px-6 py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-yellow-600 border-t-transparent"></div>
            <p className="text-lg font-medium text-yellow-700">
              Generating graph for {selectedBook?.title}...
            </p>
          </div>
        </div>
      )}

      {state?.mermaidSyntax && selectedBook && hasSubmitted && !isPending && (
        <GraphCard
          graphDefinition={state.mermaidSyntax}
          emojis={state.emojis}
          title={selectedBook.title}
          author={selectedBook.author_name}
          coverImageUrl={selectedBook.coverImageUrl}
        />
      )}
    </div>
  )
}
