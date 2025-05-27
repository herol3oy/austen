'use server'

interface Book {
  key: string
  title: string
  author_name: string
}

interface OpenLibraryDoc {
  key: string
  title: string
  author_name: string[]
}

interface OpenLibraryResponse {
  docs: OpenLibraryDoc[]
}

const OPEN_LIBRARY_SEARCH_URL = 'https://openlibrary.org/search.json'

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
      }))
  } catch (error) {
    console.error('Error fetching books:', error)
    throw new Error('Failed to search books')
  }
}
