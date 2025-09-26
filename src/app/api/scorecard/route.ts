import { NextResponse } from "next/server";
import { z } from "zod";
import { getPersona } from "@/lib/personaProvider";
import { getIndustry } from "@/lib/industryProvider";

const CHANNEL_WEIGHTS: Record<string, number> = {
  instagram: 0.9,
  facebook: 0.85,
  tiktok: 0.8,
  google: 1.0,
  whatsapp: 0.95,
  referidos: 1.1,
  doctoralia: 1.0,
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
  noShowRangePct?: [number, number];
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

const fmt = (mx: number) => `MX$${Math.round(mx).toLocaleString("es-MX")}`;
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
function supportBonuses(support: string[]) {
  const highIntent = new Set(["google", "whatsapp", "referidos", "doctoralia"]);
  const trustHelpers = new Set(["whatsapp", "referidos", "google"]);
  const hiCount = support.filter((c) => highIntent.has(c)).length;
  const trustCount = support.filter((c) => trustHelpers.has(c)).length;
  const effBonus = Math.min(1, hiCount >= 2 ? 1 : hiCount * 0.5);
  const convBonus = Math.min(1, trustCount >= 2 ? 1 : trustCount * 0.5);
  return { effBonus, convBonus };
}
function resolveChannelFit(mainChannel: string, persona?: any) {
  const ch = normChannel(mainChannel);
  const top: string[] | undefined = Array.isArray(persona?.topChannels)
    ? (persona.topChannels as string[]).map(normChannel)
    : undefined;
  if (top && top.length) {
    const good = top.includes(ch);
    return { channelFit: good ? "GOOD" : "POOR", betterChannels: good ? [] : top.slice(0, 2) };
  }
  const w = CHANNEL_WEIGHTS[ch] ?? 0.75;
  const goodHeuristic = w >= 0.95;
  const betterChannels = Object.entries(CHANNEL_WEIGHTS)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
    .filter((name) => name !== ch)
    .slice(0, 2);
  return { channelFit: goodHeuristic ? "GOOD" : "POOR", betterChannels };
}

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());

    const persona = await getPersona(body.personaType);
    const industry = await getIndustry(body.businessType);

    const bench: Bench = {
      cplTargetMXN: industry?.bench?.cplTargetMXN ?? persona?.bench?.cplTargetMXN ?? [120, 200],
      retentionP50: industry?.bench?.retentionP50 ?? persona?.bench?.retentionP50 ?? 60,
      noShowRangePct: industry?.bench?.noShowRangePct ?? persona?.bench?.noShowRangePct,
      channelCPL: industry?.bench?.channelCPL ?? persona?.bench?.channelCPL ?? undefined,
      roasTarget: industry?.bench?.roasTarget ?? persona?.bench?.roasTarget ?? 3,
    };

    const mainCh = normChannel(body.mainChannel);
    const support = normalizeSupportChannels(body.supportChannels, mainCh);
    const { effBonus } = supportBonuses(support);

    // Core math
    const clientes = Math.max(1, Math.round(body.patientsPerMonth));
    const leads = Math.max(1, Math.round(clientes * 1.2));

    const [loMain, hiMain] = resolveBenchForChannel(bench, mainCh);
    const approxCPL = body.adSpend > 0 ? Math.round(body.adSpend / leads) : loMain;

    const ingresosEst = clientes * body.avgTicket;
    const roas = body.adSpend > 0 ? ingresosEst / body.adSpend : 0;
    const roasTarget = bench.roasTarget ?? 3;

    // Scores
    const cplMainNorm = clamp01((hiMain - approxCPL) / Math.max(1, hiMain - loMain));
    let cplMainScore = Math.round(cplMainNorm * 10);
    cplMainScore = Math.max(0, Math.min(10, Math.round(cplMainScore + effBonus)));

    let cplSupportScore = support.length
      ? Math.round(
          support.reduce((acc, sc) => {
            const [lo, hi] = resolveBenchForChannel(bench, sc);
            const n = clamp01((hi - approxCPL) / Math.max(1, hi - lo));
            return acc + n * 10;
          }, 0) / support.length
        )
      : Math.round((cplMainScore * 0.9) || 7);

    const cplMidMain = (loMain + hiMain) / 2;
    const spendTargetMain = Math.max(1, Math.round(leads * cplMidMain));
    const spendRatio = body.adSpend / spendTargetMain;
    const underInvestingMain = spendRatio < 0.8;
    const overInvestingMain  = spendRatio > 1.2;

    let spendMainScore: number;
    if (spendRatio >= 0.8 && spendRatio <= 1.2) {
      const delta = Math.abs(1 - spendRatio) / 0.2;
      spendMainScore = Math.round(10 - 2 * delta);
    } else if (spendRatio < 0.8) {
      const t = clamp01((spendRatio - 0.3) / (0.8 - 0.3));
      spendMainScore = Math.round(0 + t * 8);
    } else {
      const t = clamp01((2.0 - spendRatio) / (2.0 - 1.2));
      spendMainScore = Math.round(6 * t + 8 * (1 - t));
      spendMainScore = Math.max(6, Math.min(8, spendMainScore));
    }

    const roasScore = Math.round(clamp01(roas / roasTarget) * 10);

    const efficiencyScore = Math.round(
      0.30 * cplMainScore +
      0.15 * cplSupportScore +
      0.20 * spendMainScore +
      0.20 * roasScore +
      0.15 * 7
    );

    const { channelFit, betterChannels } = resolveChannelFit(mainCh, persona);

    const noSeRepeat = body.returnRate.toLowerCase().includes("no");
    const returnOutOf10 = bucketMidpoint(body.returnRate);
    const retentionTargetPct = Math.round(bench.retentionP50 ?? 60);
    const typicalOutOf10 = Math.round((retentionTargetPct ?? 60) / 10);

    // --- New statuses & deltas ---
    type CplStatus = "LOW" | "ON" | "HIGH";
    const cplStatus: CplStatus =
      approxCPL < loMain ? "LOW" : approxCPL > hiMain ? "HIGH" : "ON";

    // Over-investing savings (if current > target)
    const overspendMXN = Math.max(0, body.adSpend - spendTargetMain);

    // “Clientes caros” overage vs hiMain
    const perClientOverage = Math.max(0, approxCPL - hiMain);
    const monthlyOverageMXN = perClientOverage * leads; // approx “pago de más” este mes

    // Extra clients if we raise spend to target (under-investing)
    const extraSpend = Math.max(0, spendTargetMain - body.adSpend);
    const extraLeads = extraSpend > 0 ? Math.round(extraSpend / Math.max(1, approxCPL)) : 0;
    const extraClients = extraLeads > 0 ? Math.round(extraLeads / 1.2) : 0;

    // ROAS shortfall vs target, expressed in pesos
    const roasGap = Math.max(0, roasTarget - roas);
    const roasShortfallMXN = Math.round(roasGap * body.adSpend);

    // ---- Narratives (precise & layman) ----
    const narratives: string[] = [];

    // CPL exact
    narratives.push(
      `Hoy cada cliente nuevo te cuesta aproximadamente ${fmt(approxCPL)}; ` +
      `en negocios como el tuyo lo normal es entre ${fmt(loMain)} y ${fmt(hiMain)}.`
    );

    // Under / Over investing
    if (underInvestingMain) {
      narratives.push(
        `Con la inversión actual (${fmt(body.adSpend)}) podrías estar quedándote corto en alcance; ` +
        `lo recomendable sería invertir ${fmt(spendTargetMain)}, lo que te traería ~${extraClients} clientes más.`
      );
    } else if (overInvestingMain) {
      narratives.push(
        `Estás invirtiendo por encima de lo típico; si ajustas hacia ${fmt(spendTargetMain)} ` +
        `podrías ahorrar ~${fmt(overspendMXN)} este mes sin perder mucho alcance.`
      );
      if (betterChannels.length) {
        narratives.push(
          `Sugerencia: prueba reasignar parte de ese ahorro a ${betterChannels[0]}${betterChannels[1] ? ` o ${betterChannels[1]}` : ""} para mejorar la intención.`
        );
      }
    } else {
      narratives.push(`Tu inversión total está dentro de un rango sano para aprovechar mejor el canal principal.`);
    }

    // Clientes “caros” (CPL por arriba del benchmark)
    if (cplStatus === "HIGH") {
      narratives.push(
        `Tus clientes nuevos están saliendo caros para ${mainCh} (${fmt(approxCPL)} vs tope típico ${fmt(hiMain)}). ` +
        `Podrías estar pagando ~${fmt(monthlyOverageMXN)} de más este mes. Revisa segmentación, anuncio/oferta y seguimiento.`
      );
    }

    // Canales de apoyo
    if (support.length) {
      narratives.push(`Además de ${mainCh}, tus clientes también te encuentran por ${support.join(", ")}.`);
    }

    // ROAS + shortfall
    if (body.adSpend > 0) {
      const roasRounded = Math.max(0, Math.round(roas * 10) / 10);
      const base = `Por cada peso que inviertes, recuperas aprox. ${roasRounded}. El promedio esperado es ${roasTarget}×.`;
      narratives.push(roasShortfallMXN > 0 ? `${base} Podrías estar perdiendo ${fmt(roasShortfallMXN)} en ventas potenciales.` : base);
    }

    // Repetición
    if (noSeRepeat) {
      narratives.push(`Si no tienes el dato de repetición, lo normal en negocios como el tuyo es ~${typicalOutOf10} de cada 10. Podemos ayudarte a medirlo.`);
    } else {
      narratives.push(`De cada 10 clientes nuevos, regresan ~${Math.round(returnOutOf10)}; lo normal es ~${typicalOutOf10}.`);
    }

    // Fit de canal
    if (channelFit === "POOR") {
      narratives.push(
        `Estás invirtiendo en ${mainCh}, pero tus clientes suelen buscar más en ${betterChannels[0]}${betterChannels[1] ? ` o ${betterChannels[1]}` : ""}.`
      );
    }

    type Focus = "optimize_spend" | "improve_sales" | "change_channel" | "choose";
    let suggestedFocus: Focus = "choose";
    const convBad = (returnOutOf10 < (retentionTargetPct / 10)) || (support.length === 0);

    if (channelFit === "POOR") {
      const supportHasHighIntent = support.some((c) => ["google", "whatsapp", "referidos", "doctoralia"].includes(c));
      suggestedFocus = supportHasHighIntent ? "choose" : "change_channel";
      if (underInvestingMain) suggestedFocus = "choose";
    } else {
      if (underInvestingMain || overInvestingMain) suggestedFocus = "optimize_spend";
      else if (cplStatus === "HIGH") suggestedFocus = "optimize_spend";
      else if (convBad) suggestedFocus = "improve_sales";
      else suggestedFocus = "choose";
    }

    // DEBUG (keep while validating)
    return NextResponse.json({
      efficiencyScore,
      narratives,
      suggestedFocus,
      debug: {
        inputs: {
          patientsPerMonth: body.patientsPerMonth,
          avgTicket: body.avgTicket,
          adSpend: body.adSpend,
          mainChannel: mainCh,
          supportChannels: support,
        },
        benchUsed: { loMain, hiMain, roasTarget },
        computed: {
          clientes, leads, approxCPL,
          spendTargetMain, spendRatio: Number(spendRatio.toFixed(2)),
          overspendMXN, perClientOverage, monthlyOverageMXN,
          extraClients,
          roas: Number((Math.round(roas * 100) / 100).toFixed(2)),
        },
        statuses: { cplStatus, underInvestingMain, overInvestingMain },
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Bad request" }, { status: 400 });
  }
}