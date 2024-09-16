import { defineEventHandler, readBody } from 'h3';
import { GoogleGenerativeAI } from '@google/generative-ai';

const systemInstruction = `
  You're a bookworm and an assistant. You'll provide the name of a book,
  and you will create a graph for its characters using Mermaid js syntax. 
  You can find the following as a sample for the book "The Wonderful Wizard of Oz". 
  Please refrain from including any explanations or descriptions at the beginning or end and 
  avoid adding notes or anything else and simply provide the syntax. 
  Do not include syntax highlighting for the syntax.

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
`;

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  systemInstruction,
});

export default defineEventHandler(async (event) => {
  const { bookTitle } = await readBody(event);

  try {
    const result = await model.generateContent(bookTitle);
    const mermaidContent = result.response.text();
    return { mermaidContent };
  } catch (error) {
    console.error('Error generating content:', error);
    return { error: 'Failed to generate Mermaid content' };
  }
});
