// src/lib/industryProvider.ts
import fs from "fs/promises";
import path from "path";

type Bench = {
  cplTargetMXN: [number, number];
  retentionP50: number;
  roasTarget?: number;
  channelCPL?: Record<string, [number, number]>;
  noShowRangePct?: [number, number];
};

export type Industry = {
  id: string;
  name: string;
  bench: Bench;
};

const INDUSTRIES_DIR = path.join(process.cwd(), "data", "industries");

// In production we can cache; in dev always read fresh.
const IS_PROD = process.env.NODE_ENV === "production";
let cacheAll: Industry[] | null = null;

function normId(id: string) {
  return (id ?? "").toString().trim().toLowerCase();
}

export async function listIndustries(): Promise<Industry[]> {
  if (IS_PROD && cacheAll) return cacheAll;

  const files = await fs.readdir(INDUSTRIES_DIR);
  const out: Industry[] = [];

  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    const p = path.join(INDUSTRIES_DIR, f);
    try {
      const raw = await fs.readFile(p, "utf8");
      const parsed = JSON.parse(raw);

      const id = normId(parsed?.id ?? f.replace(/\.json$/i, ""));
      const name = (parsed?.name ?? id).toString().trim();
      const bench = parsed?.bench;

      if (!id || !name || !bench) continue;

      // Normalize channel keys to lowercase
      if (bench.channelCPL) {
        const norm: Record<string, [number, number]> = {};
        for (const [k, v] of Object.entries(bench.channelCPL)) {
          if (Array.isArray(v) && v.length === 2) {
            norm[normId(k)] = [Number(v[0]), Number(v[1])];
          }
        }
        bench.channelCPL = norm;
      }

      out.push({ id, name, bench });
    } catch {
      // skip malformed JSON silently (or console.warn in dev)
      if (!IS_PROD) console.warn(`[industries] Skipping invalid file: ${f}`);
    }
  }

  // Sort by name for stable UX
  out.sort((a, b) => a.name.localeCompare(b.name, "es"));

  if (IS_PROD) cacheAll = out;
  return out;
}

export async function getIndustry(id: string): Promise<Industry | null> {
  const all = await listIndustries();
  const needle = normId(id);
  return all.find((i) => i.id === needle) ?? null;
}