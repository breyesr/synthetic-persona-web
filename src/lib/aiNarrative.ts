// src/lib/aiNarrative.ts
import OpenAI from "openai";

export type NarrativeInputs = {
  businessType: string;
  city: string;

  patientsPerMonth: number;
  avgTicket: number;
  adSpend: number;

  mainChannel: string;
  supportChannels: string[];

  benchLo: number;
  benchHi: number;
  roasTarget: number;

  approxLeads: number;
  approxCPL: number;
  spendTargetMain: number;
  underInvestingMain: boolean;
  overInvestingMain: boolean;

  roas: number;

  returnOutOf10: number;
  typicalOutOf10: number;
};

const fmt = (n: number) => `MX$${Math.round(n).toLocaleString("es-MX")}`;
const oneDecimal = (n: number) => Math.round(n * 10) / 10;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/** ────────────────────────────────────────────────────────────────────────────
 * LLM rewrite for the scorecard narrative (layman Spanish).
 * Fallback is deterministic and still friendly.
 * ──────────────────────────────────────────────────────────────────────────── */
export async function buildAIDiagnostic(inputs: NarrativeInputs): Promise<string[]> {
  const stub = buildNarrativeStub(inputs);
  if (!openai) return stub;

  const system = `
Eres un consultor que explica resultados de negocio en español sencillo para dueños de PyME.
Nada de jerga técnica (evita "ROAS", "CPL"). Incluye números en pesos cuando aporten contexto.
Responde como viñetas cortas (1 línea por viñeta), máximo 6 viñetas.
`.trim();

  const user = `
Datos del negocio:
- Tipo: ${inputs.businessType} en ${inputs.city}
- Clientes/mes: ${inputs.patientsPerMonth}
- Personas interesadas/mes (aprox): ${inputs.approxLeads}
- Ticket promedio: ${fmt(inputs.avgTicket)}
- Inversión actual: ${fmt(inputs.adSpend)} (rango saludable: ~${fmt(inputs.spendTargetMain)})
- Costo por cliente (aprox): ${fmt(inputs.approxCPL)} (lo normal: ${fmt(inputs.benchLo)}–${fmt(inputs.benchHi)})
- Recuperación por peso invertido (sin jerga): ~${oneDecimal(inputs.roas)} (meta ~${inputs.roasTarget}×)
- Repetición: ~${Math.round(inputs.returnOutOf10)}/10 (típico ~${Math.round(inputs.typicalOutOf10)}/10)
- Canales: principal ${inputs.mainChannel}${inputs.supportChannels?.length ? `; apoyo: ${inputs.supportChannels.join(", ")}` : ""}

Escribe viñetas claras y amables para un dueño no marketer. Usa frases como:
“con tu inversión actual…”, “lo normal en tu sector…”, “con estos ajustes, podrías…”.
`.trim();

  try {
    const out = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    });

    const text = out.choices[0]?.message?.content?.trim();
    if (!text) return stub;

    const lines = text
      .split(/\r?\n/)
      .map(s => s.replace(/^[-•]\s*/, "").trim())
      .filter(Boolean);

    return lines.length ? lines.slice(0, 6) : stub;
  } catch {
    return stub;
  }
}

/** Deterministic fallback with numbers, in layman terms. */
export function buildNarrativeStub(i: NarrativeInputs): string[] {
  const lines: string[] = [];
  lines.push(`Hoy cada cliente nuevo te cuesta aprox. ${fmt(i.approxCPL)}; lo normal en negocios como el tuyo es entre ${fmt(i.benchLo)} y ${fmt(i.benchHi)}.`);
  if (i.underInvestingMain) {
    const diff = Math.max(0, i.spendTargetMain - i.adSpend);
    const extraLeads = Math.max(1, Math.round(diff / Math.max(1, i.approxCPL / 1.2)));
    lines.push(`Con tu inversión actual (${fmt(i.adSpend)}) podrías quedarte corto; acercarte a ~${fmt(i.spendTargetMain)} te daría +${extraLeads} personas interesadas aprox.`);
  } else if (i.overInvestingMain) {
    const ahorro = Math.max(0, i.adSpend - i.spendTargetMain);
    lines.push(`Estás por encima del rango saludable; ajustar hacia ~${fmt(i.spendTargetMain)} puede ahorrarte ~${fmt(ahorro)} sin perder mucho alcance.`);
  } else {
    lines.push(`Tu inversión está en un rango saludable para aprovechar mejor el canal principal.`);
  }
  lines.push(`Por cada peso que inviertes, recuperas ~${oneDecimal(i.roas)}; en tu sector se espera ~${i.roasTarget}×.`);
  lines.push(`De cada 10 clientes nuevos, regresan ~${Math.round(i.returnOutOf10)}; lo típico es ~${Math.round(i.typicalOutOf10)}.`);
  if (i.supportChannels?.length) {
    lines.push(`Además de ${i.mainChannel}, también te encuentran por ${i.supportChannels.join(", ")}.`);
  }
  return lines;
}

/** ───────────────────────── INSIGHTS BUILDER ─────────────────────────
 * We synthesize:
 *  - whatClientWantsSummary: 1 sentence (no bullet repetition)
 *  - whatToDoThisWeek: concrete steps (with pesos)
 *  - expectedImpact: simple math expectations
 *  - howToKnow: leading indicators
 *  - howToTalk: tone & comms tactics derived from channels + context
 * --------------------------------------------------------------------- */
export function buildActionableInsights(args: {
  personaName: string;
  inputs: NarrativeInputs;
  personaBullets: { doubts: string[]; suggestions: string[] };
}) {
  const { personaName, inputs, personaBullets } = args;

  const summary = synthesizeClientAsk(personaName, personaBullets);

  const over = Math.max(0, inputs.adSpend - inputs.spendTargetMain);
  const under = Math.max(0, inputs.spendTargetMain - inputs.adSpend);

  const steps: string[] = [];
  if (over > 0) {
    steps.push(`Ajusta la inversión hacia ~${fmt(inputs.spendTargetMain)} y usa el resto (~${fmt(over)}) en contenido que dé confianza (precios claros, pasos, tiempos, testimonios y videos reales).`);
  } else if (under > 0) {
    steps.push(`Sube gradualmente tu inversión hacia ~${fmt(inputs.spendTargetMain)} para llegar a más personas sin disparar el costo por cliente.`);
  } else {
    steps.push(`Mantén la inversión en el rango saludable y refuerza confianza: rangos de precio, proceso con tiempos y contacto directo sin presión.`);
  }

  steps.push(`En tu página/listado, muestra “precio desde–hasta”, pasos y tiempo estimado, y agrega WhatsApp directo con el mensaje “te explico sin presión”.`);
  if (inputs.supportChannels?.length) {
    steps.push(`Refuerza ${inputs.supportChannels[0]} con fotos/videos reales y llamados a la acción simples (p. ej., “ver disponibilidad” o “agendar visita”).`);
  }

  const targetCPL = Math.round((inputs.benchLo + inputs.benchHi) / 2);
  const freed = Math.max(0, inputs.adSpend - inputs.spendTargetMain);
  const addedLeadsRough = Math.max(
    0,
    Math.round((freed + Math.max(0, inputs.approxCPL - targetCPL) * inputs.approxLeads) / Math.max(1, targetCPL))
  );
  const addedClientsRough = Math.max(0, Math.round(addedLeadsRough / 1.2));

  const expectedImpact = [
    `Si bajas tu costo por cliente hacia ~${fmt(targetCPL)}, podrías atraer +${Math.max(1, Math.min(6, addedLeadsRough))} personas interesadas/mes.`,
    `A tus tasas actuales, eso sería ~${Math.max(1, Math.min(5, addedClientsRough))} clientes adicionales/mes.`,
    freed > 0
      ? `Ajustando inversión a ~${fmt(inputs.spendTargetMain)} liberas ~${fmt(freed)}/mes para contenido que reduce dudas y baja costos.`
      : `Con inversión saludable, el foco en confianza ayuda a bajar costos y convertir más sin aumentar gasto.`
  ];

  const howToKnow = [
    `Más mensajes pidiendo “precios, pasos y tiempos”.`,
    `Costo por cliente bajando hacia ~${fmt(targetCPL)}.`,
    `Más recomendaciones/visitas agendadas tras enviar tu paquete de confianza.`
  ];

  const howToTalk = deriveHowToTalk(inputs);

  return {
    whatClientWantsSummary: summary,
    whatToDoThisWeek: steps,
    expectedImpact,
    howToKnow,
    howToTalk
  };
}

/** Create a one-sentence summary of the client’s ask (no bullet repetition). */
function synthesizeClientAsk(personaName: string, pb: { doubts: string[]; suggestions: string[] }): string {
  const text = [...(pb.doubts || []), ...(pb.suggestions || [])].join(" • ").toLowerCase();

  const wantsPrice = /precio|costo|mensualidad|pagar|presupuesto/.test(text);
  const wantsProcess = /paso|proceso|tiempo|entrega|escritur|agenda|cita/.test(text);
  const wantsProof = /testimoni|caso|foto|video|ejemplo|resultado|real/.test(text);
  const wantsNoPressure = /sin presión|presión|insist|hostigar|agobio/.test(text) || /trato|atención/.test(text);

  const parts: string[] = [];
  if (wantsPrice) parts.push("rangos de precio claros");
  if (wantsProcess) parts.push("pasos y tiempos del proceso");
  if (wantsProof) parts.push("pruebas reales (fotos, videos, testimonios)");
  if (wantsNoPressure) parts.push("un trato cercano y sin presión");

  const core =
    parts.length > 0
      ? parts.join(", ").replace(/, ([^,]+)$/, " y $1")
      : "información clara, ejemplos reales y una conversación sin presión";

  return `${core}.`;
}

/** Derive tone & communication tactics from channels + context. */
function deriveHowToTalk(i: NarrativeInputs): string[] {
  const out: string[] = [];

  const lcMain = (i.mainChannel || "").toLowerCase();
  const support = (i.supportChannels || []).map(s => s.toLowerCase());

  const usesWhatsApp = lcMain === "whatsapp" || support.includes("whatsapp");
  const usesFacebook = lcMain === "facebook" || support.includes("facebook") || support.includes("instagram");
  const usesGoogle = lcMain === "google" || support.includes("google");
  const usesReferidos = lcMain === "referidos" || support.includes("referidos");

  if (i.returnOutOf10 < (i.typicalOutOf10 - 1)) {
    out.push("Tono cercano y cero presión: guía y resuelve dudas, no “cierres”.");
  } else {
    out.push("Directo pero empático: resume beneficios y deja claro el siguiente paso.");
  }

  if (usesWhatsApp) out.push("Usa WhatsApp como hilo principal: respuestas rápidas (menos de 10 min) y mensajes cortos con opciones claras.");
  if (usesGoogle) out.push("En Google/Maps: información concreta (rango de precios, zona, disponibilidad) y llamados a la acción simples.");
  if (usesFacebook) out.push("En Facebook/Instagram: fotos y videos reales; evita stock. Incluye subtítulos con “precio desde” y “cómo empezar”.");
  if (usesReferidos) out.push("Con referidos: menciona brevemente la persona/fuente y ofrece un trato preferente para reforzar confianza.");

  if (i.avgTicket >= 8000) {
    out.push("Habla de dinero sin rodeos (rangos y costos habituales) y explica el proceso paso a paso con tiempos.");
  } else {
    out.push("Resalta promociones/paquetes y la facilidad para empezar hoy mismo.");
  }

  return out.slice(0, 5);
}