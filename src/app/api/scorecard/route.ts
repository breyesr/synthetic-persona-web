// src/app/api/scorecard/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPersona } from "@/lib/personaProvider";
import { getIndustry } from "@/lib/industryProvider";
import { buildAIDiagnostic, NarrativeInputs } from "@/lib/aiNarrative";

export const runtime = "nodejs";

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
const normChannel = (raw?: string) => (norm(raw) in CHANNEL_WEIGHTS ? norm(raw) : "otros");

const Body = z.object({
  personaType: z.string(),
  businessType: z.string().min(1),
  city: z.string(),
  patientsPerMonth: z.number().nonnegative(),
  avgTicket: z.number().nonnegative(),
  mainChannel: z.string(),
  adSpend: z.number().nonnegative(),
  returnRate: z.string(),
  supportChannels: z.array(z.string()).optional(),
});

type Bench = {
  cplTargetMXN: [number, number];
  retentionP50: number;
  channelCPL?: Record<string, [number, number]>;
  roasTarget?: number;
};

const bucketMidpoint = (bucket: string): number => {
  const map: Record<string, number> = {
    "0-2": 1, "3-4": 3.5, "5-6": 5.5, "7-8": 7.5, "9-10": 9.5,
  };
  if (bucket.toLowerCase().includes("no")) return 5;
  return map[bucket] ?? 5;
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function resolveBenchForChannel(bench: Bench, ch: string): [number, number] {
  const n = normChannel(ch);
  const byChannel = bench.channelCPL?.[n];
  return byChannel ?? bench.cplTargetMXN ?? [120, 200];
}
function normalizeSupportChannels(raw?: string[], main?: string) {
  const mainN = normChannel(main);
  const set = new Set<string>();
  for (const r of raw ?? []) {
    const n = normChannel(r);
    if (!n || n === "otros" || n === mainN) continue;
    set.add(n);
  }
  return Array.from(set);
}

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const persona = await getPersona(body.personaType);
    const industry = await getIndustry(body.businessType);

    const bench: Bench = {
      cplTargetMXN: industry?.bench?.cplTargetMXN ?? persona?.bench?.cplTargetMXN ?? [120, 200],
      retentionP50: industry?.bench?.retentionP50 ?? persona?.bench?.retentionP50 ?? 60,
      channelCPL: industry?.bench?.channelCPL ?? persona?.bench?.channelCPL ?? undefined,
      roasTarget: industry?.bench?.roasTarget ?? persona?.bench?.roasTarget ?? 3,
    };

    const mainCh = normChannel(body.mainChannel);
    const support = normalizeSupportChannels(body.supportChannels, mainCh);

    const clientes = Math.max(1, Math.round(body.patientsPerMonth));
    const leads = Math.max(1, Math.round(clientes * 1.2));
    const [loMain, hiMain] = resolveBenchForChannel(bench, mainCh);
    const approxCPL = body.adSpend > 0 ? Math.round(body.adSpend / leads) : loMain;

    const cplMainNorm = clamp01((hiMain - approxCPL) / Math.max(1, hiMain - loMain));
    const cplMainScore = Math.round(cplMainNorm * 10);

    const mid = (loMain + hiMain) / 2;
    const spendTargetMain = Math.max(1, Math.round(leads * mid));
    const spendRatio = spendTargetMain > 0 ? body.adSpend / spendTargetMain : 1;
    const underInvestingMain = spendRatio < 0.8;
    const overInvestingMain  = spendRatio > 1.2;

    const ingresosEst = clientes * body.avgTicket;
    const roas = body.adSpend > 0 ? ingresosEst / body.adSpend : 0;
    const roasScore = Math.round(clamp01(roas / (bench.roasTarget ?? 3)) * 10);

    const efficiencyScore = Math.round(
      0.45 * cplMainScore +
      0.25 * roasScore +
      0.30 * (10 - Math.min(10, Math.abs(1 - spendRatio) * 10))
    );

    const inputs: NarrativeInputs = {
      businessType: industry?.name ?? body.businessType,
      city: body.city,
      patientsPerMonth: clientes,
      avgTicket: body.avgTicket,
      adSpend: body.adSpend,
      mainChannel: mainCh,
      supportChannels: support,
      benchLo: loMain,
      benchHi: hiMain,
      roasTarget: bench.roasTarget ?? 3,
      approxLeads: leads,
      approxCPL,
      spendTargetMain,
      underInvestingMain,
      overInvestingMain,
      roas,
      returnOutOf10: bucketMidpoint(body.returnRate),
      typicalOutOf10: Math.round((bench.retentionP50 ?? 60) / 10),
    };

    const narratives = await buildAIDiagnostic(inputs);

    return NextResponse.json({
      efficiencyScore,
      narratives,
      suggestedFocus:
        overInvestingMain || underInvestingMain ? "optimize_spend"
        : (cplMainScore < 6 ? "optimize_spend" : "choose"),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Bad request" }, { status: 400 });
  }
}