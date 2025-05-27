'use client'

import { X } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'

import { Input } from '@/components/ui/input'

import { generateGraph } from './actions/generate-graph'
import { requestOpenlibBooks } from './actions/request-openlib-books'

interface Book {
  key: string
  title: string
  author_name: string
}

interface GraphResult {
  mermaidSyntax: string
  emojis: string
}

const MIN_SEARCH_LENGTH = 3
const MAX_SEARCH_LENGTH = 100

export default function Home() {
  const [isPending, startTransition] = useTransition()
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [searchResults, setSearchResults] = useState<Book[]>([])
  const [showResults, setShowResults] = useState<boolean>(false)
  const [graphResult, setGraphResult] = useState<GraphResult | null>(null)
  const [hasSearched, setHasSearched] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const requestBooks = async () => {
      if (!searchTerm.trim() || searchTerm.length < MIN_SEARCH_LENGTH) {
        setSearchResults([])
        setHasSearched(false)
        return
      }

      startTransition(async () => {
        try {
          const books = await requestOpenlibBooks(searchTerm)
          startTransition(() => {
            setSearchResults(books)
            setHasSearched(true)
          })
        } catch (error) {
          console.error('Error fetching books:', error)
          setSearchResults([])
          setHasSearched(false)
        }
      })
    }

    const debounceTimer = setTimeout(requestBooks, 400)
    return () => clearTimeout(debounceTimer)
  }, [searchTerm])

  const handleClear = () => {
    setSearchTerm('')

    setSearchResults([])
    setShowResults(false)
    setHasSearched(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value.length <= MAX_SEARCH_LENGTH) {
      setSearchTerm(value)
      setShowResults(true)
    }
  }

  const handleBookSelect = async (book: Book) => {
    setShowResults(false)
    setSearchTerm(book.title)
    setError(null)

    startTransition(async () => {
      try {
        const result = await generateGraph(book.title, book.author_name)
        setGraphResult(result)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to generate graph',
        )
        setGraphResult(null)
      }
    })
  }

  const isSearchValid = searchTerm.length >= MIN_SEARCH_LENGTH
  const showNoResults =
    hasSearched && searchResults.length === 0 && !isPending && isSearchValid

  return (
    <div className="relative mx-auto max-w-lg p-4">
      <div className="relative w-full">
        <Input
          type="text"
          placeholder={`Enter a book title (min ${MIN_SEARCH_LENGTH} characters)`}
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          className={`w-full pr-8 ${isPending ? 'cursor-not-allowed opacity-50' : ''}`}
          maxLength={MAX_SEARCH_LENGTH}
        />
        {searchTerm && (
          <button
            onClick={handleClear}
            disabled={isPending}
            className="absolute top-1/2 right-2 -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={18} />
          </button>
        )}

        {showResults &&
          (searchResults.length > 0 || isPending || showNoResults) && (
            <div className="absolute z-10 mt-1 max-h-[300px] w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
              {isPending ? (
                <div className="flex items-center justify-center gap-2 p-4 text-center text-gray-500">
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-gray-500"></div>
                  Searching...
                </div>
              ) : showNoResults ? (
                <div className="p-4 text-center text-gray-500">
                  <div className="mb-1 text-gray-400">📚</div>
                  <div className="font-medium">No books found</div>
                  <div className="text-sm">
                    Try searching for a different title
                  </div>
                </div>
              ) : (
                <div className="py-1">
                  {searchResults.map((book) => (
                    <button
                      key={book.key}
                      onClick={() => handleBookSelect(book)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                    >
                      <div className="font-medium">{book.title}</div>
                      <div className="text-sm text-gray-600">
                        by {book.author_name}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-600">
          {error}
        </div>
      )}

      {graphResult && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow">
          <div className="mb-4">
            <pre className="mt-2 overflow-x-auto text-sm whitespace-pre-wrap">
              {graphResult.mermaidSyntax}
            </pre>
          </div>
          <div>
            <div className="mt-2 text-2xl">{graphResult.emojis}</div>
          </div>
        </div>
      )}
    </div>
  )
}
