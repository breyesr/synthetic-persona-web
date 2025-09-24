// app/api/scorecard/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPersona } from "@/lib/personaProvider";

// Gentle channel weighting (same as UI options)
const CHANNEL_WEIGHTS: Record<string, number> = {
  instagram: 0.9,
  facebook: 0.85,
  tiktok: 0.8,
  google: 1.0,
  whatsapp: 0.95,
  referidos: 1.1,
  otros: 0.75,
};
const normChannel = (raw?: string) =>
  (raw ?? "").toLowerCase().trim() in CHANNEL_WEIGHTS
    ? (raw ?? "").toLowerCase().trim()
    : "otros";

const Body = z.object({
  personaType: z.string(),
  city: z.string(),
  patientsPerMonth: z.number(),
  avgTicket: z.number(),
  mainChannel: z.string(),           // we normalize it ourselves
  adSpend: z.number(),
  returnRate: z.string(),            // "0-2" | "3-4" | "5-6" | "7-8" | "9-10"
});

// Compute scores using persona.bench with safe defaults if missing
function scoreEfficiencyFromBench(input: {
  cplTargetMXN: [number, number];
  adSpend: number;
  patientsPerMonth: number;
  mainChannel?: string;
}) {
  const [lo, hi] = input.cplTargetMXN ?? [120, 200];
  const leads = Math.max(1, Math.round(input.patientsPerMonth * 1.2));
  const cpl = input.adSpend > 0 ? Math.round(input.adSpend / leads) : lo;

  let s = 10 - ((cpl - lo) / Math.max(1, hi - lo)) * 5; // base from earlier logic
  const w = CHANNEL_WEIGHTS[normChannel(input.mainChannel)];
  s = s * w;

  s = Math.max(0, Math.min(10, Math.round(s)));
  return { approxLeads: leads, approxCPL: cpl, score: s };
}

function scoreConversionFromBench(input: {
  retentionP50: number;
  returnRateBucket: string;
  mainChannel?: string;
}) {
  const bucketMap: Record<string, number> = {
    "0-2": 2, "3-4": 4, "5-6": 6, "7-8": 8, "9-10": 9, nose: 5,
  };
  let s = Math.round(bucketMap[input.returnRateBucket] ?? 5);

  if (s >= 6 && input.retentionP50 >= 60) s = Math.min(9, s + 1);
  if (s <= 4 && input.retentionP50 >= 60) s = Math.min(6, s + 1);

  const w = CHANNEL_WEIGHTS[normChannel(input.mainChannel)];
  s = Math.round(s * (w >= 1 ? 1.05 : 0.95));

  s = Math.max(1, Math.min(9, s));
  return s;
}

// Very light, deterministic objections/suggestions (keep your version if you already have one)
function basicObjections(mainChannel: string) {
  const ch = normChannel(mainChannel);
  return [
    ch === "tiktok" ? "Baja intención, hay que filtrar mejor" : "Validar intención desde el anuncio",
    "No prometas resultados irreales (evita claims médicos)",
    "Refuerza prueba social: testimonios/antes-después legales",
  ];
}
function basicSuggestions(mainChannel: string) {
  const ch = normChannel(mainChannel);
  return [
    ch === "referidos" ? "Activa programa de referidos (10–15%)" : "Instala botón WhatsApp con respuestas rápidas",
    "Ofrece paquete de 3–5 consultas (mejora retención)",
    "Agenda recordatorios 24h y 2h antes para bajar no-shows",
  ];
}

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    // 1) Load persona to get file-backed bench (if available)
    const persona = await getPersona(body.personaType);
    const bench = persona?.bench ?? {
      cplTargetMXN: [120, 200] as [number, number],
      retentionP50: 60,
      noShowRangePct: [15, 25] as [number, number],
    };

    // 2) Compute scores using bench
    const eff = scoreEfficiencyFromBench({
      cplTargetMXN: bench.cplTargetMXN,
      adSpend: body.adSpend,
      patientsPerMonth: body.patientsPerMonth,
      mainChannel: body.mainChannel,
    });
    const conv = scoreConversionFromBench({
      retentionP50: bench.retentionP50,
      returnRateBucket: body.returnRate,
      mainChannel: body.mainChannel,
    });

    // 3) Deterministic objections/suggestions (replace with your existing ones if you already had them)
    const objections = basicObjections(body.mainChannel);
    const suggestions = basicSuggestions(body.mainChannel);

    return NextResponse.json({
      efficiencyScore: eff.score,
      conversionScore: conv,
      approxLeads: eff.approxLeads,
      approxCPL: eff.approxCPL,
      objections,
      suggestions,
      usedBench: bench, // debug visibility
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Bad request" },
      { status: 400 }
    );
  }
}