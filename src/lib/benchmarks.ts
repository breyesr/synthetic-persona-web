// src/lib/benchmarks.ts

export type PersonaType =
  | "nutriologa"
  | "odontologa"
  | "psicologo"
  | "fisioterapeuta"
  | "estetica";

type Bench = {
  cplTargetMXN: [number, number];
  retentionP50: number;
  noShowRangePct: [number, number];
};

// New: channel weights + normalizer (safe defaults)
export const CHANNEL_WEIGHTS: Record<string, number> = {
  instagram: 0.9,
  facebook: 0.85,
  tiktok: 0.8,
  google: 1.0,
  whatsapp: 0.95,   // good for follow-ups
  referidos: 1.1,   // strongest conversion leverage
  otros: 0.75,      // unknown/other = conservative
};

export function normalizeMainChannel(
  raw?: string
): keyof typeof CHANNEL_WEIGHTS {
  const val = (raw ?? "").toLowerCase().trim();
  if (val in CHANNEL_WEIGHTS) return val as keyof typeof CHANNEL_WEIGHTS;
  return "otros";
}

export const BENCHMARKS: Record<PersonaType, Bench> = {
  nutriologa:     { cplTargetMXN: [90, 120],  retentionP50: 60, noShowRangePct: [20, 30] },
  odontologa:     { cplTargetMXN: [150, 250], retentionP50: 65, noShowRangePct: [15, 25] },
  psicologo:      { cplTargetMXN: [120, 200], retentionP50: 70, noShowRangePct: [10, 20] },
  fisioterapeuta: { cplTargetMXN: [100, 180], retentionP50: 65, noShowRangePct: [15, 25] },
  estetica:       { cplTargetMXN: [120, 220], retentionP50: 55, noShowRangePct: [15, 25] },
};

// Updated: optional mainChannel (backward compatible)
export function scoreEfficiency(input: {
  personaType: PersonaType;
  adSpend: number;
  patientsPerMonth: number;
  mainChannel?: string; // <-- new but optional
}) {
  const { cplTargetMXN } = BENCHMARKS[input.personaType];
  const approxLeads = Math.max(1, Math.round(input.patientsPerMonth * 1.2));
  const approxCPL =
    input.adSpend > 0
      ? Math.round(input.adSpend / approxLeads)
      : cplTargetMXN[0];

  const [lo, hi] = cplTargetMXN;
  let s = 10 - ((approxCPL - lo) / Math.max(1, hi - lo)) * 5;

  // Channel influence (gentle nudge, not dominant)
  const ch = normalizeMainChannel(input.mainChannel);
  const w = CHANNEL_WEIGHTS[ch];
  s = s * w;

  // Clamp 1..9 like before
  s = Math.max(1, Math.min(9, Math.round(s)));

  return { approxLeads, approxCPL, score: s };
}

// Updated: optional mainChannel (backward compatible)
export function scoreConversion(input: {
  personaType: PersonaType;
  returnRateBucket: string;
  mainChannel?: string; // <-- new but optional
}) {
  const target = BENCHMARKS[input.personaType].retentionP50;
  const bucketMap: Record<string, number> = {
    "0-2": 2,
    "3-4": 4,
    "5-6": 6,
    "7-8": 8,
    "9-10": 9,
    nose: 5,
  };
  let s = Math.round(bucketMap[input.returnRateBucket] ?? 5);

  // Persona baseline adjustments (existing logic kept)
  if (s >= 6 && target >= 60) s = Math.min(9, s + 1);
  if (s <= 4 && target >= 60) s = Math.min(6, s + 1);

  // Channel influence (conversion favors higher-trust channels a bit)
  const ch = normalizeMainChannel(input.mainChannel);
  const w = CHANNEL_WEIGHTS[ch];
  s = Math.round(s * (w >= 1 ? 1.05 : 0.95));

  // Clamp 1..9
  s = Math.max(1, Math.min(9, s));
  return s;
}