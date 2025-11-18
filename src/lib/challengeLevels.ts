// src/lib/challengeLevels.ts
import fs from "fs/promises";
import path from "path";

export type ChallengeLevel = {
  id: string;
  intensity: number;
  name: string;
  detail: string;
  tone: string | { style?: string; voiceRules?: string[] };
  guidance: string;
  questionStyle: string | { tone?: string; examples?: string[] };
  description?: string;
  purpose?: string;
  behavior?: Record<string, unknown>;
  outputRequirements?: Record<string, unknown>;
};

const DATA_DIR = path.join(process.cwd(), "data", "challengelevels");
const IS_PROD = process.env.NODE_ENV === "production";

let cache: ChallengeLevel[] | null = null;

async function loadAll(): Promise<ChallengeLevel[]> {
  if (IS_PROD && cache) return cache;
  try {
    const entries = await fs.readdir(DATA_DIR);
    const list: ChallengeLevel[] = [];

    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      const full = path.join(DATA_DIR, entry);
      try {
        const raw = await fs.readFile(full, "utf8");
        const parsed = JSON.parse(raw);
        const level: ChallengeLevel = {
          id: String(parsed?.id ?? "").trim(),
          intensity: Number(parsed?.intensity ?? 0),
          name: String(parsed?.name ?? "").trim(),
          detail: String(parsed?.detail ?? parsed?.description ?? "").trim(),
          tone: parsed?.tone ?? "",
          guidance: String(parsed?.guidance ?? "").trim(),
          questionStyle: parsed?.questionStyle ?? "",
          description: typeof parsed?.description === "string" ? parsed.description : undefined,
          purpose: typeof parsed?.purpose === "string" ? parsed.purpose : undefined,
          behavior: parsed?.behavior ?? undefined,
          outputRequirements: parsed?.outputRequirements ?? undefined,
        };
        if (!level.id || !level.name) continue;
        list.push(level);
      } catch {
        // skip malformed file
      }
    }

    list.sort((a, b) => a.intensity - b.intensity || a.name.localeCompare(b.name, "en"));
    if (IS_PROD) cache = list;
    return list;
  } catch {
    return [];
  }
}

export async function listChallengeLevels(): Promise<ChallengeLevel[]> {
  return loadAll();
}

export async function getChallengeLevel(
  idOrIntensity: string | number
): Promise<ChallengeLevel | null> {
  const all = await loadAll();
  const id = typeof idOrIntensity === "string" ? idOrIntensity.trim().toLowerCase() : "";
  const intensity =
    typeof idOrIntensity === "number"
      ? idOrIntensity
      : Number.isFinite(Number(idOrIntensity))
        ? Number(idOrIntensity)
        : NaN;
  return (
    all.find((lvl) => lvl.id.toLowerCase() === id) ??
    (Number.isFinite(intensity) ? all.find((lvl) => lvl.intensity === intensity) : undefined) ??
    null
  );
}
