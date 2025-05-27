'use server'

interface Book {
  key: string
  title: string
  author_name: string[]
}

interface OpenLibraryDoc {
  key: string
  title: string
  author_name: string[]
}

interface OpenLibraryResponse {
  docs: OpenLibraryDoc[]
}

export const searchBooks = async (searchTerm: string): Promise<Book[]> => {
  if (!searchTerm.trim()) {
    return []
  }

  try {
    const response = await fetch(
      `https://openlibrary.org/search.json?title=${encodeURIComponent(searchTerm)}`,
      { cache: 'no-store' },
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
        author_name: book.author_name,
      }))
  } catch (error) {
    console.error('Error fetching books:', error)
    throw new Error('Failed to search books')
  }
}
