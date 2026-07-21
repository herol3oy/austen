const CORS_ORIGINS = [
  "https://herol3oy.github.io",
  "http://localhost:8788",
];

function getCorsHeaders(origin) {
  const allowed = CORS_ORIGINS.includes(origin) ? origin : CORS_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: getCorsHeaders(origin) });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: getCorsHeaders(origin),
      });
    }

    const headers = getCorsHeaders(origin);

    try {
      const body = await request.json();
      const book = body.book;

      if (!book || !book.title) {
        return new Response(JSON.stringify({ error: "Missing book data" }), {
          status: 400,
          headers,
        });
      }

      const apiKey = env.DEEPSEEK_API_KEY;
      if (!apiKey) {
        throw new Error("DeepSeek API key not configured on the server.");
      }

      const prompt = `
        You are an expert in literature and Mermaid.js.
        Create a character relationship diagram for the book "${book.title}" by ${book.authors.join(', ')}.
        
        Requirements:
        - Use standard Mermaid graph syntax (graph LR).
        - Include the top 5-8 main characters.
        - Arrows should indicate the relationship (e.g., A -->|Friends| B).
        - Output ONLY the raw Mermaid syntax. Do not include markdown formatting like \`\`\`mermaid or explanations.
      `;

      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: "You are a helpful assistant that strictly follows formatting constraints." },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const errData = await response.text();
        throw new Error(`DeepSeek API failed: ${errData}`);
      }

      const data = await response.json();
      let mermaidText = data.choices[0].message.content;
      mermaidText = mermaidText.replace(/```mermaid\n?/gi, "").replace(/```/g, "").trim();

      return new Response(
        JSON.stringify({ mermaid: mermaidText, generatedAt: new Date().toISOString() }),
        { headers }
      );
    } catch (error) {
      console.error("Generation Error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to generate diagram", details: error.message }),
        { status: 500, headers }
      );
    }
  },
};
