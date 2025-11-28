// src/app/api/persona/route.ts
import { OpenAIStream, StreamingTextResponse, StreamData } from 'ai';
import { z } from 'zod';
import { openai } from '@/lib/clients';
import { getPersona } from '@/lib/personaProvider'; // Use the central provider
import { hybridSearch } from '@/lib/rag'; // Keep for type definitions, or just copy the type

export const runtime = 'nodejs'; // Use Node.js runtime for file system access

const Body = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).min(1),
  personaType: z.string(),
});

function buildPrompt(personaName: string, query: string, context: string) {
  return `
You are playing the role of ${personaName}.
Based on the following context about your persona, answer the user's question in the first person.
If the context does not contain the answer, state that you do not have an opinion on the matter.

Context:
---
${context}
---

User's Question: ${query}

Your Answer (as ${personaName}):
  `.trim();
}

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const { messages, personaType } = body;

    // The user's question is the last message in the array
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'user' || !lastMessage.content) {
      throw new Error('Invalid last message format.');
    }
    const question = lastMessage.content;

    // 1. Get persona and RAG context from the central provider
    const persona = await getPersona(personaType, question);
    if (!persona) {
      return new Response(JSON.stringify({ error: "Persona not found" }), { status: 404 });
    }

    // 2. Create a StreamData instance to send context to the frontend
    // Note: We don't have the raw search results here anymore, so we can't send sources.
    // This is a trade-off of this simpler architecture.
    // We could modify getPersona to return the sources as well if needed.
    const data = new StreamData();
    data.append({
      type: 'sources',
      sources: [{ source_file: `${persona.id}.json`, persona_id: persona.id }],
    });

    // 3. Build the prompt for the LLM
    const prompt = buildPrompt(persona.name, question, persona.context);

    // 4. Request the OpenAI API for a streaming completion
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    });

    // 5. Convert the response into a friendly text-stream
    const stream = OpenAIStream(response, {
      onFinal(completion) {
        data.close();
      },
    });

    // 6. Respond with the stream, passing the StreamData as the first argument
    return new StreamingTextResponse(stream, {}, data);

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Bad request';
    console.error("Error in /api/persona:", err);
    return new Response(JSON.stringify({ error: msg }), { status: 400 });
  }
}