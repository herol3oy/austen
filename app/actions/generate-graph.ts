'use server'

import OpenAI from 'openai'

import { SYSTEM_INSTRUCTION } from '@/consts/system-instruction'
import { GenerateGraphResponse } from '@/types/generate-graph-response'

const openai = new OpenAI({
  baseURL: process.env.LANGUAGE_MODEL_BASE_URL,
  apiKey: process.env.LANGUAGE_MODEL_API_KEY,
})

export const generateGraph = async (
  bookTitle: string,
  authorName: string,
): Promise<GenerateGraphResponse> => {
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

    const content = completion.choices?.[0]?.message?.content?.trim()

    if (!content) {
      throw new Error('No response content from AI model')
    }

    const [mermaidPart, emojisPart] = content.split('Emojis:')

    if (!mermaidPart) {
      throw new Error('Invalid response format: Mermaid syntax is missing')
    }

    return {
      mermaidSyntax: mermaidPart.trim(),
      emojis: emojisPart?.trim() || '',
    }
  } catch (err) {
    console.error('Error generating graph:', err)

    throw err instanceof Error
      ? err
      : new Error('Unexpected error during graph generation')
  }
}
