'use client'

import { AlertCircle, Search, Sparkles, X } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'

import { generateGraph } from '@/app/actions/generate-graph'
import { requestOpenlibBooks } from '@/app/actions/request-openlib-books'
import { GraphCard } from '@/components/GraphCard'
import { Input } from '@/components/ui/input'

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
  const [error, setError] = useState<string | null>(null)
  const [selectedBookKey, setSelectedBookKey] = useState<string | null>(null)
  const [isGeneratingGraph, setIsGeneratingGraph] = useState<boolean>(false)

  const isSearchValid = searchTerm.length >= MIN_SEARCH_LENGTH
  const hasSearched =
    searchResults.length > 0 ||
    (!isPending && isSearchValid && searchTerm.trim())

  const selectedBook =
    searchResults.find((b) => b.key === selectedBookKey) || null

  useEffect(() => {
    if (!searchTerm.trim() || !isSearchValid) {
      setSearchResults([])
      return
    }

    const debounceTimer = setTimeout(() => {
      startTransition(async () => {
        try {
          const books = await requestOpenlibBooks(searchTerm)
          setSearchResults(books)
        } catch (error) {
          console.error('Error fetching books:', error)
          setSearchResults([])
        }
      })
    }, 400)

    return () => clearTimeout(debounceTimer)
  }, [searchTerm, isSearchValid])

  const handleClear = () => {
    setSearchTerm('')
    setSearchResults([])
    setShowResults(false)
    setSelectedBookKey(null)
    setError(null)
    setGraphResult(null)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value.length <= MAX_SEARCH_LENGTH) {
      setSearchTerm(value)
      setShowResults(true)
      setError(null)
    }
  }

  const handleBookSelect = async (book: Book) => {
    setShowResults(false)
    setSearchTerm(book.title)
    setError(null)
    setGraphResult(null)
    setSelectedBookKey(book.key)
    setIsGeneratingGraph(true)

    try {
      const result = await generateGraph(book.title, book.author_name)
      setGraphResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate graph')
    } finally {
      setIsGeneratingGraph(false)
    }
  }

  const showNoResults =
    hasSearched && searchResults.length === 0 && !isPending && isSearchValid

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 relative z-10 mx-auto max-w-7xl px-6 py-20 text-center duration-1000">
      <div className="mb-12 text-center">
        <div className="mb-8">
          <span className="inline-flex items-center rounded-full border border-teal-200/60 bg-white/80 px-4 py-2 text-sm font-medium text-teal-700 backdrop-blur-sm">
            <Sparkles className="mr-2 h-4 w-4" />
            Unleash the Story&apos;s Magic
          </span>
        </div>
        <h1 className="mb-6 bg-gradient-to-r from-teal-700 via-emerald-700 to-cyan-700 bg-clip-text text-6xl leading-tight font-bold text-transparent md:text-7xl">
          Find Your Book
        </h1>

        <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-600 sm:text-xl">
          Search for any book and discover its story relationships
        </p>

        <div className="relative mx-auto w-full max-w-4xl">
          <div className="relative">
            <Input
              type="text"
              placeholder={`Enter a book title (min ${MIN_SEARCH_LENGTH} characters)`}
              value={searchTerm}
              onChange={handleInputChange}
              onFocus={() => setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 200)}
              className={`h-16 w-full rounded-2xl border-2 border-gray-200 bg-white px-6 pr-16 text-lg shadow-lg transition-all duration-200 placeholder:text-gray-400 hover:border-gray-300 hover:shadow-xl focus:border-blue-500 focus:shadow-xl focus:ring-4 focus:ring-blue-500/20 sm:h-20 sm:px-8 sm:pr-20 sm:text-xl`}
              maxLength={MAX_SEARCH_LENGTH}
            />

            <div className="absolute top-1/2 right-4 -translate-y-1/2 sm:right-6">
              {searchTerm ? (
                <button
                  onClick={handleClear}
                  className="rounded-full p-2 text-gray-400 transition-all duration-200 hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Clear search"
                >
                  <X size={24} className="sm:h-6 sm:w-6" />
                </button>
              ) : (
                <div className="p-2 text-gray-400">
                  <Search size={24} className="sm:h-6 sm:w-6" />
                </div>
              )}
            </div>

            {showResults &&
              (searchResults.length > 0 || isPending || showNoResults) && (
                <div className="absolute z-50 mt-4 max-h-[400px] w-full overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-gray-100/50 backdrop-blur-sm">
                  {isPending ? (
                    <div className="flex items-center justify-center gap-3 p-8 text-center text-gray-500">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500"></div>
                      <span className="text-lg font-medium">
                        Searching for books...
                      </span>
                    </div>
                  ) : showNoResults ? (
                    <div className="p-8 text-center text-gray-500">
                      <div className="mb-4 text-4xl">📚</div>
                      <div className="mb-2 text-xl font-semibold text-gray-700">
                        No books found
                      </div>
                      <div className="text-base text-gray-500">
                        Try searching for a different title or author
                      </div>
                    </div>
                  ) : (
                    <div className="py-2">
                      {searchResults.map((book, index) => (
                        <button
                          key={book.key}
                          onClick={() => handleBookSelect(book)}
                          className={`w-full border-l-4 border-transparent px-6 py-4 text-left transition-all duration-150 hover:border-blue-400 hover:bg-blue-50 focus:border-blue-400 focus:bg-blue-50 focus:outline-none ${
                            index !== searchResults.length - 1
                              ? 'border-b border-gray-100'
                              : ''
                          }`}
                        >
                          <div className="mb-1 text-lg leading-tight font-semibold text-gray-900">
                            {book.title}
                          </div>
                          <div className="flex items-center gap-2 text-base text-gray-600">
                            <span>by</span>
                            <span className="font-medium text-gray-700">
                              {book.author_name}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
          </div>
        </div>
      </div>

      {isGeneratingGraph && (
        <div className="mx-auto mb-8 max-w-4xl">
          <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-lg">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-teal-600 sm:h-12 sm:w-12" />
            <p className="mt-4 text-lg font-medium text-gray-800">
              Generating your story graph
              {selectedBook && ` for "${selectedBook.title}"`}...
            </p>
            <p className="mt-2 text-sm text-gray-500">
              This might take a few moments.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mx-auto mb-8 max-w-4xl">
          <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-6 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <div className="text-lg font-medium text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {graphResult && selectedBook && (
        <div className="mt-12">
          <GraphCard
            graphDefinition={graphResult.mermaidSyntax}
            emojis={graphResult.emojis}
            title={selectedBook.title}
            author={selectedBook.author_name}
          />
        </div>
      )}
    </div>
  )
}
