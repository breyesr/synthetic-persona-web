// app/api/persona/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPersona } from "@/lib/personaProvider";
import { getIndustry } from "@/lib/industryProvider";
import OpenAI from "openai";

export const runtime = "nodejs";

const Body = z.object({
  personaType: z.string(),
  businessType: z.string().min(1), // business/industry of the user
  city: z.string().optional(),
  question: z.string().optional(),
  focus: z.enum(["efficiency", "conversion", "insight"]).optional(),
  personaContext: z.string().optional(),
});

const PersonaQA = z.object({
  reaction: z.string(),
  dudasCliente: z.array(z.string()).min(1).max(5),
  sugerencias: z.array(z.string()).min(1).max(5),
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

    const industry = await getIndustry(body.businessType);
    const industryName = industry?.name ?? body.businessType;
    const city = body.city ?? "tu ciudad";

    // If no question → just metadata
    if (!body.question) {
      return NextResponse.json({
        ok: true,
        persona: persona.name,
        industry: industryName,
        contextPreview: persona.context.slice(0, 120),
        bench: persona.bench ?? null,
      });
    }

    // ✅ Persona voice: first-person, WhatsApp-y, no consultant/marketing jargon.
    //    Suggestions must be phrased as things *I (cliente) necesitaría/vería*,
    //    not instructions for the business.
    const systemPrompt = `
Eres ${persona.name}, un cliente ideal del negocio del usuario.
Hablas como si me escribieras por WhatsApp: breve, natural y en PRIMERA PERSONA.
Contexto: yo tengo un negocio de "${industryName}" en ${city}.

Muy importante:
- Responde como CLIENTE, no como consultor ni marketer.
- No des "consejos" al negocio. En su lugar, expresa lo que YO necesitaría/vería/esperaría para decidirme.
- Evita jerga de marketing (CPM, creatividades, funnels, segmentación, etc.).
- Sé empático y directo, como una persona real.

Devuelve SOLO un JSON válido con este formato exacto:
{
  "reaction": "reacción corta en primera persona (máx. 25 palabras, tono WhatsApp)",
  "dudasCliente": ["3 a 5 dudas reales que tendría antes de comprar/contratar"],
  "sugerencias": ["3 a 5 cosas que ME darían confianza y me harían decidirme (en primera persona)"],
  "conversionLikelihood": 0-10 número entero (qué tan probable es que te compre ahora)
}
`.trim();

    const userMsg = `
Pregunta del negocio (${industryName} en ${city}):
- ${body.question}

Enfoque: ${body.focus ?? "insight"}
Recuerda: habla como cliente (yo), en primera persona. Nada de lenguaje de agencia ni instrucciones al negocio.
`.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = PersonaQA.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Malformed model output", details: parsed.error.format() },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      persona: persona.name,     // friendly persona name
      industry: industryName,    // friendly industry name
      ...parsed.data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Bad request" },
      { status: 400 }
    );
  }
}