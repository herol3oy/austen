'use client'

import { X } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'

import { Input } from '@/components/ui/input'

import { searchBooks } from './actions'

interface Book {
  key: string
  title: string
  author_name: string[]
}

const MIN_SEARCH_LENGTH = 3
const MAX_SEARCH_LENGTH = 100

export default function Home() {
  const [isPending, startTransition] = useTransition()
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [searchResults, setSearchResults] = useState<Book[]>([])
  const [showResults, setShowResults] = useState<boolean>(false)
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [hasSearched, setHasSearched] = useState<boolean>(false)

  useEffect(() => {
    const requestBooks = async () => {
      if (!searchTerm.trim() || searchTerm.length < MIN_SEARCH_LENGTH) {
        setSearchResults([])
        setHasSearched(false)
        return
      }

      startTransition(async () => {
        try {
          const books = await searchBooks(searchTerm)
          setSearchResults(books)
          setHasSearched(true)
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
    setSelectedBook(null)
    setSearchResults([])
    setShowResults(false)
    setHasSearched(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value.length <= MAX_SEARCH_LENGTH) {
      setSearchTerm(value)
      setShowResults(true)
      setSelectedBook(null)
    }
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
          disabled={isPending}
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
                    <div
                      key={book.key}
                      className="flex cursor-pointer flex-col px-4 py-3 transition-colors hover:bg-gray-100"
                      onClick={() => {
                        setSelectedBook(book)
                        setShowResults(false)
                      }}
                    >
                      <span className="font-medium text-gray-900">
                        {book.title}
                      </span>
                      <span className="text-sm text-gray-600">
                        by {book.author_name.slice(0, 2).join(', ')}
                        {book.author_name.length > 2 &&
                          ` +${book.author_name.length - 2} more`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
      </div>

      {selectedBook && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4 shadow">
          <h2 className="text-xl font-semibold text-gray-800">
            {selectedBook.title}
          </h2>
          <p className="mt-1 text-gray-600">
            by {selectedBook.author_name.slice(0, 3).join(', ')}
            {selectedBook.author_name.length > 3 &&
              ` +${selectedBook.author_name.length - 3} more`}
          </p>
          <div className="mt-2 text-xs text-gray-500">
            Selected from search results
          </div>
        </div>
      )}
    </div>
  )
}
