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

let cacheAll: Industry[] | null = null;

export async function listIndustries(): Promise<Industry[]> {
  if (cacheAll) return cacheAll;
  const files = await fs.readdir(INDUSTRIES_DIR);
  const out: Industry[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    const p = path.join(INDUSTRIES_DIR, f);
    const raw = await fs.readFile(p, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed?.id && parsed?.name && parsed?.bench) out.push(parsed as Industry);
  }
  cacheAll = out;
  return out;
}

export async function getIndustry(id: string): Promise<Industry | null> {
  const all = await listIndustries();
  return all.find((i) => i.id === id) ?? null;
}