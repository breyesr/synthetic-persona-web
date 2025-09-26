// app/api/persona/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPersona } from "@/lib/personaProvider";
import OpenAI from "openai";

export const runtime = "nodejs";

const Body = z.object({
  personaType: z.string(),
  city: z.string().optional(),
  question: z.string().optional(),
  focus: z.enum(["efficiency", "conversion"]).optional(),
  personaContext: z.string().optional(),
});

// Schema for persona Q&A response
const PersonaQA = z.object({
  reaction: z.string(),
  dudasCliente: z.array(z.string()),
  sugerencias: z.array(z.string()),
  conversionLikelihood: z.number().min(0).max(10),
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const persona = await getPersona(body.personaType, body.personaContext);
    if (!persona) {
      return NextResponse.json({ error: "Persona not found" }, { status: 404 });
    }

    // If no question, return metadata only
    if (!body.question) {
      return NextResponse.json({
        ok: true,
        persona: persona.name,
        contextPreview: persona.context.slice(0, 120),
        bench: persona.bench ?? null,
      });
    }

    // Build system prompt for persona Q&A
    const systemPrompt = `
Eres un paciente ideal simulado (${persona.name}) en ${body.city ?? "tu ciudad"}.
Responde a la pregunta del usuario como si fueras ese cliente, en español claro y sencillo.
Devuelve SOLO un JSON válido con este formato exacto:
{
  "reaction": "reacción corta en primera persona",
  "dudasCliente": ["3 dudas concretas que tendría el cliente"],
  "sugerencias": ["3 recomendaciones prácticas para mejorar confianza/conversión"],
  "conversionLikelihood": 0-10 número entero
}
    `.trim();

    // Call OpenAI with JSON schema enforcement
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Pregunta: ${body.question}\nEnfoque: ${body.focus ?? "general"}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = PersonaQA.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Malformed model output",
          details: parsed.error.format(),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      persona: persona.name,
      bench: persona.bench ?? null,
      ...parsed.data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Bad request" },
      { status: 400 }
    );
  }
}
