'use server'

import OpenAI from 'openai'

const SYSTEM_INSTRUCTION = `
  You're a bookworm. Given a book title and author, create a simple character graph using valid Mermaid JS syntax.
  Additionally, provide 5 emojis that are related to the book.
  
  Do not include any explanations or language indicators.

  Example result for "The Wonderful Wizard of Oz" by "L. Frank Baum":

  graph TD
    A[Dorothy Gale] -->|Pet| B[Toto]
    A -->|Family| C[Uncle Henry and Aunt Em]
    A -->|Friends| D[Scarecrow]
    A -->|Friends| E[Tin Woodman]
    A -->|Friends| F[Cowardly Lion]
    A -->|Enemy| G[The Wicked Witch of The West]
    A -->|Enemy| H[The Wizard of OZ]
    A -->|Helps Dorothy| I[Glinda]
    D -->|Friends| E
    E -->|Friends| F
    B -->|In Kansas| C

  Emojis: 🏠🌪️👠🦁🧙
`

const openai = new OpenAI({
  baseURL: process.env.LANGUAGE_MODEL_BASE_URL,
  apiKey: process.env.LANGUAGE_MODEL_API_KEY,
})

interface GenerateGraphResponse {
  mermaidSyntax: string
  emojis: string
  error?: string
}

export async function generateGraph(
  bookTitle: string,
  authorName: string,
): Promise<GenerateGraphResponse> {
  if (!bookTitle || !authorName) {
    throw new Error('Book title and author name are required')
  }

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        {
          role: 'user',
          content: `Book: ${bookTitle}, Author: ${authorName}`,
        },
      ],
      model: process.env.LANGUAGE_MODEL_NAME!,
      temperature: 0.7,
    })

    const responseContent = completion.choices[0]?.message?.content

    if (!responseContent) {
      throw new Error('No response from AI model')
    }

    const [mermaidPart, emojisPart] = responseContent.split('Emojis:')

    if (!mermaidPart) {
      throw new Error('Invalid response format from AI model')
    }

    return {
      mermaidSyntax: mermaidPart.trim(),
      emojis: emojisPart?.trim() || '',
    }
  } catch (error) {
    console.error('Error generating graph:', error)
    throw error instanceof Error
      ? error
      : new Error('Failed to generate Mermaid syntax and emojis')
  }
}
