// src/app/api/persona/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPersona } from "@/lib/personaProvider";
import OpenAI from "openai";

export const runtime = "nodejs";

const Body = z.object({
  personaType: z.string(),
  city: z.string().optional(),
  question: z.string().optional(),
  // NEW: "insight" to learn needs/fears/motivators
  focus: z.enum(["efficiency", "conversion", "insight"]).optional(),
  personaContext: z.string().optional(),
});

const PersonaQA = z.object({
  reaction: z.string(),
  dudasCliente: z.array(z.string()),
  sugerencias: z.array(z.string()),
  conversionLikelihood: z.number().min(0).max(10),
});

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const persona = await getPersona(body.personaType, body.personaContext);
    if (!persona) return NextResponse.json({ error: "Persona not found" }, { status: 404 });

    if (!body.question) {
      return NextResponse.json({
        ok: true,
        persona: persona.name,
        contextPreview: persona.context.slice(0, 120),
        bench: persona.bench ?? null,
      });
    }

    const guidance =
      body.focus === "efficiency"
        ? "Concéntrate en precio percibido, claridad de oferta y fricciones para decidir. No hables de plataformas o campañas."
        : body.focus === "conversion"
        ? "Concéntrate en confianza, pruebas sociales, garantías, proceso post-compra/visita y seguimiento."
        : "Habla de necesidades, miedos, motivadores, preferencias de comunicación y objeciones típicas. Nada de jerga de marketing.";

    const systemPrompt = `
Eres ${persona.name}, un cliente potencial en ${body.city ?? "tu ciudad"}.
Responde en primera persona como si fueras ese cliente, con lenguaje claro y sencillo.
${guidance}

Devuelve SOLO un JSON válido exactamente con este formato:
{
  "reaction": "frase corta en primera persona",
  "dudasCliente": ["3 dudas concretas que tendría este cliente"],
  "sugerencias": ["3 acciones simples que aumentarían mi confianza o interés"],
  "conversionLikelihood": 0-10
}
    `.trim();

    if (openai) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Pregunta: ${body.question}\nEnfoque: ${body.focus ?? "insight"}` },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";
      try {
        const parsed = PersonaQA.parse(JSON.parse(raw));
        return NextResponse.json({ ok: true, persona: persona.name, ...parsed });
      } catch {
        // fall through to deterministic fallback
      }
    }

    // Deterministic fallback
    return NextResponse.json({
      ok: true,
      persona: persona.name,
      reaction: "Necesito entender mejor qué obtengo y si se ajusta a mi situación.",
      dudasCliente: [
        "¿Qué resultados puedo esperar y en cuánto tiempo?",
        "¿Cuál es el costo total y qué incluye exactamente?",
        "¿Cómo me daré cuenta de que voy por buen camino?"
      ],
      sugerencias: [
        "Muéstrame ejemplos reales de clientes como yo",
        "Explícame el paso a paso y tiempos estimados",
        "Ofrece una forma de probar con bajo riesgo"
      ],
      conversionLikelihood: 5
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Bad request" }, { status: 400 });
  }
}