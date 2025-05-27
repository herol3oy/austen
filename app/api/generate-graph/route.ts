import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const systemInstruction = `
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
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
})

interface BookRequest {
  bookTitle: string
  authorName: string
}

interface BookResponse {
  mermaidSyntax: string
  emojis: string
}

export async function POST(request: Request) {
  try {
    const { bookTitle, authorName } = (await request.json()) as BookRequest

    if (!bookTitle || !authorName) {
      return NextResponse.json(
        { error: 'Book title and author name are required' },
        { status: 400 },
      )
    }

    const completion = await openai.chat.completions.create({
      messages: [
        { role: 'system' as const, content: systemInstruction },
        {
          role: 'user' as const,
          content: `Book: ${bookTitle}, Author: ${authorName}`,
        },
      ],
      model: 'deepseek-chat',
      temperature: 0.7,
    })

    const responseContent = completion.choices[0]?.message?.content

    if (!responseContent) {
      return NextResponse.json(
        { error: 'No response from AI model' },
        { status: 500 },
      )
    }

    const [mermaidPart, emojisPart] = responseContent.split('Emojis:')

    if (!mermaidPart) {
      return NextResponse.json(
        { error: 'Invalid response format from AI model' },
        { status: 500 },
      )
    }

    const responseData: BookResponse = {
      mermaidSyntax: mermaidPart.trim(),
      emojis: emojisPart?.trim() || '',
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Error generating syntax:', error)

    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Failed to generate graph: ${error.message}` },
        { status: 500 },
      )
    }

    return NextResponse.json(
      { error: 'Failed to generate Mermaid syntax and emojis' },
      { status: 500 },
    )
  }
}
