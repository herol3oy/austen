import { defineEventHandler, readBody } from 'h3';
import OpenAI from 'openai';

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
`;

const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env['DEEPSEEK_API_KEY'],
});

interface BookResponse {
  mermaidSyntax: string;
  emojis: string;
}

export default defineEventHandler(async (event) => {
  const { bookTitle, authorName } = await readBody(event);

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: `Book: ${bookTitle}, Author: ${authorName}` },
      ],
      model: 'deepseek-chat',
    });

    const responseContent = completion.choices[0].message.content;

    const mermaidSyntax = responseContent?.split('Emojis:')[0]?.trim() || '';
    const emojis = responseContent?.split('Emojis:')[1]?.trim() || '';

    const response: BookResponse = {
      mermaidSyntax,
      emojis,
    };

    return response;
  } catch (error) {
    console.error('Error generating syntax:', error);
    return { error: 'Failed to generate Mermaid syntax and emojis' };
  }
});
