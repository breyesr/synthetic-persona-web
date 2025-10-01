// src/app/api/persona/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPersona } from "@/lib/personaProvider";
import { getIndustry } from "@/lib/industryProvider";
import OpenAI from "openai";
import { buildActionableInsights, NarrativeInputs } from "@/lib/aiNarrative";

export const runtime = "nodejs";

const Body = z.object({
  personaType: z.string(),
  businessType: z.string().min(1),
  city: z.string().optional(),
  question: z.string().min(1),
  focus: z.enum(["efficiency", "conversion", "insight"]).optional(),
  personaContext: z.string().optional(),

  patientsPerMonth: z.number().nonnegative().optional(),
  avgTicket: z.number().nonnegative().optional(),
  adSpend: z.number().nonnegative().optional(),
  mainChannel: z.string().optional(),
  supportChannels: z.array(z.string()).optional(),
  returnRate: z.string().optional(),
});

const PersonaQA = z.object({
  reaction: z.string(),
  answerToQuestion: z.string(),
  dudasCliente: z.array(z.string()).min(1).max(6),
  sugerencias: z.array(z.string()).min(1).max(6),
  conversionLikelihood: z.number().min(0).max(10),
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CHANNEL_WEIGHTS: Record<string, number> = {
  instagram: 0.9,
  facebook: 0.85,
  tiktok: 0.8,
  google: 1.0,
  whatsapp: 0.95,
  referidos: 1.1,
  otros: 0.75,
};

const norm = (raw?: string) => (raw ?? "").toLowerCase().trim();
const normChannel = (raw?: string) =>
  (norm(raw) in CHANNEL_WEIGHTS ? norm(raw) : "otros");

const bucketMidpoint = (bucket?: string): number => {
  if (!bucket) return 5;
  const map: Record<string, number> = {
    "0-2": 1,
    "3-4": 3.5,
    "5-6": 5.5,
    "7-8": 7.5,
    "9-10": 9.5,
  };
  if (bucket.toLowerCase().includes("no")) return 5;
  return map[bucket] ?? 5;
};

function buildSystemPrompt(opts: {
  personaName: string;
  industryName: string;
  city: string;
}) {
  const { personaName, industryName, city } = opts;
  return `
Eres ${personaName}, pero RESPONDES como si fueras un CLIENTE REAL de un negocio de ${industryName} en ${city}.
Tono: WhatsApp, humano, directo y en PRIMERA PERSONA. Nada de jerga de marketing ni voz de consultor.
Primero, responde de forma directa a la pregunta específica (1–2 frases, claras y concretas).
Luego, lista mis dudas naturales (como cliente) y qué me daría confianza para decidir.
No hables de tu profesión original si no es ${industryName}; ignórala.

Devuelve SOLO un JSON EXACTO con:
{
  "reaction": "frase corta (máx. 25 palabras) en primera persona",
  "answerToQuestion": "2–4 frases respondiendo la pregunta EXACTA en mi voz de cliente",
  "dudasCliente": ["3–5 dudas naturales sobre ${industryName}"],
  "sugerencias": ["3–5 señales de confianza que YO quisiera ver"],
  "conversionLikelihood": 0-10
}
`.trim();
}

function buildUserMessage(opts: {
  industryName: string;
  city: string;
  question: string;
  focus?: string;
  personaContext?: string;
}) {
  const { industryName, city, question, focus, personaContext } = opts;
  return `
Pregunta del negocio (${industryName} en ${city}):
- ${question}

Enfoque: ${focus ?? "insight"}

Contexto breve de la persona (solo para tono/valores):
${(personaContext ?? "").slice(0, 400)}

Instrucciones:
1) Responde PRIMERO la pregunta exacta en 2–4 frases desde mi perspectiva de cliente.
2) NO des consejos técnicos de anuncios/canales.
3) Todo en primera persona, humano y directo.
`.trim();
}

// crude domain guard: flags salud-terms if industry isn't salud
function looksOffDomain(answerText: string, industryName: string) {
  const t = answerText.toLowerCase();
  const healthLeak = /(nutri|nutriólog|pacient|consulta|clínic|salud|dieta|plan nutr)/i.test(
    t
  );
  const realEstatePos =
    /(propiedad|inmueble|departamento|casa|hipoteca|escritur|renta|venta|crédito|avalúo)/i.test(
      t
    );
  if (industryName.toLowerCase().includes("salud")) return false;
  if (healthLeak && !realEstatePos) return true;
  return false;
}

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());

    const persona = await getPersona(body.personaType, body.personaContext);
    if (!persona)
      return NextResponse.json({ error: "Persona not found" }, { status: 404 });

    const industry = await getIndustry(body.businessType);
    const industryName = industry?.name ?? body.businessType;
    const city = body.city ?? "tu ciudad";

    const systemPrompt = buildSystemPrompt({
      personaName: persona.name,
      industryName,
      city,
    });

    const userMsg = buildUserMessage({
      industryName,
      city,
      question: body.question,
      focus: body.focus,
      personaContext: persona.context,
    });

    const first = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
      ],
    });

    let raw = first.choices[0]?.message?.content ?? "{}";
    let parsed = PersonaQA.safeParse(JSON.parse(raw));

    if (parsed.success) {
      const joined = [
        parsed.data.reaction,
        parsed.data.answerToQuestion,
        ...parsed.data.dudasCliente,
        ...parsed.data.sugerencias,
      ].join(" • ");
      if (looksOffDomain(joined, industryName)) {
        const correction = `
Tu respuesta no suena a cliente de ${industryName} en ${city}.
Corrige y vuelve a entregar el MISMO JSON, pero hablando SOLO como cliente de ${industryName}.
`.trim();
        const retry = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.3,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMsg },
            { role: "user", content: correction },
          ],
        });
        raw = retry.choices[0]?.message?.content ?? raw;
        parsed = PersonaQA.safeParse(JSON.parse(raw));
      }
    }

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Malformed model output", details: parsed.error.format() },
        { status: 500 }
      );
    }

    const qa = parsed.data;

    // Build insights from numbers + persona signals (question-aware tweaks below)
    let insights:
      | {
          whatClientWantsSummary: string;
          whatToDoThisWeek: string[];
          expectedImpact: string[];
          howToKnow: string[];
          howToTalk: string[];
        }
      | null = null;

    const hasNumbers =
      typeof body.patientsPerMonth === "number" &&
      typeof body.avgTicket === "number" &&
      typeof body.adSpend === "number" &&
      body.mainChannel;

    if (hasNumbers) {
      const mainCh = normChannel(body.mainChannel);
      const support = (body.supportChannels ?? [])
        .map(normChannel)
        .filter((c) => c !== "otros" && c !== mainCh);

      const benchLoHi =
        industry?.bench?.channelCPL?.[mainCh] ??
        industry?.bench?.cplTargetMXN ??
        [120, 200];

      const [lo, hi] = benchLoHi;

      const clientes = Math.max(1, Math.round(body.patientsPerMonth!));
      const leads = Math.max(1, Math.round(clientes * 1.2));
      const approxCPL = body.adSpend! > 0 ? Math.round(body.adSpend! / leads) : lo;

      const mid = (lo + hi) / 2;
      const spendTargetMain = Math.max(1, Math.round(leads * mid));
      const spendRatio = spendTargetMain > 0 ? body.adSpend! / spendTargetMain : 1;
      const under = spendRatio < 0.8;
      const over = spendRatio > 1.2;

      const ingresosEst = clientes * body.avgTicket!;
      const roas = body.adSpend! > 0 ? ingresosEst / body.adSpend! : 0;

      const inputs: NarrativeInputs = {
        businessType: industryName,
        city,
        patientsPerMonth: clientes,
        avgTicket: body.avgTicket!,
        adSpend: body.adSpend!,
        mainChannel: mainCh,
        supportChannels: support,
        benchLo: lo,
        benchHi: hi,
        roasTarget: industry?.bench?.roasTarget ?? 3,
        approxLeads: leads,
        approxCPL,
        spendTargetMain,
        underInvestingMain: under,
        overInvestingMain: over,
        roas,
        returnOutOf10: bucketMidpoint(body.returnRate),
        typicalOutOf10: Math.round((industry?.bench?.retentionP50 ?? 60) / 10),
      };

      const base = buildActionableInsights({
        personaName: persona.name,
        inputs,
        personaBullets: {
          doubts: qa.dudasCliente,
          suggestions: qa.sugerencias,
        },
      });

      // Question-aware tweak: inject one step + one KPI tied to the asked question
      const q = body.question.toLowerCase();
      const extraSteps: string[] = [];
      const extraKpis: string[] = [];

      if (/(clic|click|anuncio|publicación|post)/i.test(q)) {
        extraSteps.push(
          "Crea 1 anuncio/prueba con fotos o video reales + rango de precios + CTA a WhatsApp (“te explico sin presión”)."
        );
        extraKpis.push("Tasa de respuesta en WhatsApp > 20% de los clics.");
      } else if (/(regresar|volver|fidel|repet)/i.test(q)) {
        extraSteps.push(
          "Después de cada visita, envía en 24–48h un paquete post-visita (fotos/videos reales, pasos y costos) y pide un referido con incentivo simple."
        );
        extraKpis.push("Aumento de recomendaciones semana a semana.");
      } else if (/(precio|costo|presupuesto|mensualidad)/i.test(q)) {
        extraSteps.push(
          "Añade en tu página/listado “precio desde–hasta” y un botón de “calcular mensualidad” visible."
        );
        extraKpis.push("Más mensajes con la palabra “precio” o “mensualidad”.");
      } else if (/(confianza|testimoni|caso|prueba|real)/i.test(q)) {
        extraSteps.push(
          "Publica 2 testimonios verificables y 1 video de recorrido real; enlázalos desde el anuncio y WhatsApp."
        );
        extraKpis.push("Clics a testimonios y retención > 30s en el video.");
      }

      const whatToDoThisWeek = [
        ...extraSteps,
        ...base.whatToDoThisWeek,
      ].slice(0, 6);

      const howToKnow = [...extraKpis, ...base.howToKnow].slice(0, 5);

      insights = {
        whatClientWantsSummary: base.whatClientWantsSummary,
        whatToDoThisWeek,
        expectedImpact: base.expectedImpact,
        howToKnow,
        howToTalk: base.howToTalk,
      };
    }

    return NextResponse.json({
      ok: true,
      persona: persona.name,
      industry: industryName,
      askedQuestion: body.question,
      reaction: qa.reaction,
      answerToQuestion: qa.answerToQuestion,
      dudasCliente: qa.dudasCliente,
      sugerencias: qa.sugerencias,
      conversionLikelihood: qa.conversionLikelihood,
      insights, // may be null
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bad request";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}