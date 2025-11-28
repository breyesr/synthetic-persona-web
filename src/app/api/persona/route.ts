// src/app/api/persona/route.ts
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { z } from 'zod';
import { getPersona } from '@/lib/personaProvider';

export const runtime = 'nodejs';

// Define the API schema using Zod
const Body = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).min(1),
  personaType: z.string(),
});

// Initialize the OpenAI provider
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function buildSystemPrompt(personaName: string, context: string) {
  return `
You are playing the role of ${personaName}, a real person with genuine opinions.
Based on the following context about your persona, answer the user's question in the first person, speaking as that persona.
If the provided context does not contain enough information to form an opinion, state that you do not have an opinion on the matter.
Keep your answer concise and directly address the user's question.

## Context about you, ${personaName}:
${context}
  `.trim();
}

export async function POST(req: Request) {
  try {
    const { messages, personaType } = Body.parse(await req.json());

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

    // 2. Build the system prompt with the retrieved context
    const systemPrompt = buildSystemPrompt(persona.name, persona.context);

    // 3. Call the AI with the new system prompt and user messages
    const result = await streamText({
      model: openai('gpt-4o-mini'),
      system: systemPrompt,
      messages: messages,
    });

    // 4. Respond with the stream
    return result.toAIStreamResponse();

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Bad request';
    console.error("Error in /api/persona:", err);
    return new Response(JSON.stringify({ error: msg }), { status: 400 });
  }
}