// src/lib/personaProvider.ts
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { hybridSearch } from "@/lib/rag";

export type Bench = {
  cplTargetMXN: [number, number];
  retentionP50: number;
  noShowRangePct: [number, number];
};

export type Persona = {
  id: string;
  name: string;
  profile?: {
    goals?: string[];
    pains?: string[];
    channels?: string[];
    ethics?: string[];
  };
  locale?: string;
  context: string;
  bench?: Bench;
};

const DATA_DIR = path.join(process.cwd(), "data", "personas");

async function readPersonaFile(id: string): Promise<Persona | null> {
  const attempts = [
    path.join(DATA_DIR, `${id}.json`),
    path.join(DATA_DIR, `${id}.md`),
    path.join(DATA_DIR, id),
  ];
  let raw: string | null = null;
  try {
    for (const candidate of attempts) {
      try {
        raw = await fs.readFile(candidate, "utf8");
        break;
      } catch {
        // keep trying other paths
      }
    }
    if (!raw) return null;
    const trimmed = raw.trim();

    if (trimmed.startsWith("{")) {
      const j = JSON.parse(trimmed);
      const name: string = j.name ?? id;
      const bench: Bench | undefined = j.bench
        ? {
            cplTargetMXN: [Number(j.bench.cplTargetMXN?.[0] ?? 0), Number(j.bench.cplTargetMXN?.[1] ?? 0)] as [number, number],
            retentionP50: Number(j.bench.retentionP50 ?? 0),
            noShowRangePct: [Number(j.bench.noShowRangePct?.[0] ?? 0), Number(j.bench.noShowRangePct?.[1] ?? 0)] as [number, number],
          }
        : undefined;

      const contextParts: string[] = [];
      const add = (label: string, v: any) => {
        if (!v) return;
        if (Array.isArray(v)) contextParts.push(`${label}: ${v.join("; ")}`);
        else if (typeof v === "string") contextParts.push(`${label}: ${v}`);
      };
      add("role", j.role);
      add("city", j.city);
      add("demographics", j.demographics);
      add("business", j.business);
      add("goals", j.goals);
      add("pains", j.pains);
      add("objections", j.objections);
      add("motivations", j.motivations);
      add("channels", j.channels);

      return {
        id,
        name,
        profile: {
          goals: j.goals ?? [],
          pains: j.pains ?? [],
          channels: j.channels ?? [],
          ethics: [],
        },
        locale: j.locale ?? "es-MX",
        context: contextParts.join("\n"),
        bench,
      };
    }

    const { data, content } = matter(raw);
    return {
      id: data.id ?? id,
      name: data.name ?? id,
      profile: data.profile,
      locale: data.locale,
      context: (content ?? "").trim(),
      bench: data.bench,
    };
  } catch {
    return null;
  }
}

const FALLBACK: Record<string, Persona> = {
  nutriologa: {
    id: "nutriologa",
    name: "Nutrióloga",
    profile: { goals: ["Aumentar consultas"], pains: ["No-shows"], channels: ["Instagram"], ethics: [] },
    locale: "es-MX",
    context: "Contexto breve por defecto.",
  },
};

export async function getPersona(id: string, userQuery: string): Promise<Persona | null> {
  const file = await readPersonaFile(id);
  const base = file ?? FALLBACK[id] ?? null;
  if (!base) return null;

  // Use the user's query for hybrid search to get relevant context
  const searchResults = await hybridSearch(userQuery, id);
  const ragContext = searchResults.map(r => r.content).join("\n\n");

  // Combine the dynamic RAG context with the static context from the persona file
  const context = [ragContext, base.context].filter(Boolean).join("\n\n");

  return { ...base, context };
}

export async function listPersonas(): Promise<{ id: string; name: string }[]> {
  try {
    const entries = await fs.readdir(DATA_DIR);
    const ids = entries
      .filter(e => e.endsWith(".json") || e.endsWith(".md"))
      .map(e => e.replace(/\.(json|md)$/, ""));
    const metas = await Promise.all(ids.map(async pid => {
      const p = await readPersonaFile(pid);
      return p ? { id: p.id, name: p.name } : null;
    }));
    const existing = metas.filter(Boolean) as { id: string; name: string }[];
    const fallbacks = Object.values(FALLBACK)
      .filter(p => !existing.find(e => e.id === p.id))
      .map(p => ({ id: p.id, name: p.name }));
    return [...existing, ...fallbacks];
  } catch {
    return Object.values(FALLBACK).map(p => ({ id: p.id, name: p.name }));
  }
}
