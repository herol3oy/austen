'use server'

import { OPEN_LIBRARY_SEARCH_URL } from '@/consts/open-library-search-url'
import { Book } from '@/types/book'
import { OpenLibraryDoc } from '@/types/open-library-doc'
import { OpenLibraryResponse } from '@/types/open-library-response'

export const requestOpenlibBooks = async (
  searchTerm: string,
): Promise<Book[]> => {
  if (!searchTerm.trim()) {
    return []
  }

  try {
    const response = await fetch(
      `${OPEN_LIBRARY_SEARCH_URL}?title=${encodeURIComponent(searchTerm)}`,
    )

    if (!response.ok) {
      throw new Error('Failed to fetch books')
    }

    const { docs }: OpenLibraryResponse = await response.json()

    return docs
      .filter(
        (book: OpenLibraryDoc) => book.author_name && book.author_name.length,
      )
      .slice(0, 10)
      .map((book: OpenLibraryDoc) => ({
        key: book.key,
        title: book.title,
        author_name: book.author_name[0],
        coverImageUrl: book.cover_i
          ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
          : undefined,
      }))
  } catch (error) {
    console.error('Error fetching books:', error)
    throw new Error('Failed to search books')
  }
}
