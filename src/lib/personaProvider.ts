// src/lib/personaProvider.ts
// Server-only module: loads persona data from /data/personas as JSON or Markdown.
// Also returns optional `bench` (for scorecard) if present in the file.

import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { retrievePersonaContext } from "@/lib/ragSource";

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
  context: string;      // combined base + RAG (+ optional upload when no RAG)
  bench?: Bench;        // ← NEW: optional benchmarks from file
};

const DATA_DIR = path.join(process.cwd(), "data", "personas");

// Try to load a file as raw text, then parse as JSON-or-Markdown
async function readPersonaFile(id: string): Promise<Persona | null> {
  const filePath = path.join(DATA_DIR, `${id}.json`);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const trimmed = raw.trim();

    // Heuristic: if it looks like JSON, parse it
    if (trimmed.startsWith("{")) {
      const j = JSON.parse(trimmed);

      // Build Persona from JSON keys (keep it permissive)
      const name: string = j.name ?? id;
      const bench: Bench | undefined = j.bench
        ? {
            cplTargetMXN: [Number(j.bench.cplTargetMXN?.[0] ?? 0), Number(j.bench.cplTargetMXN?.[1] ?? 0)] as [number, number],
            retentionP50: Number(j.bench.retentionP50 ?? 0),
            noShowRangePct: [Number(j.bench.noShowRangePct?.[0] ?? 0), Number(j.bench.noShowRangePct?.[1] ?? 0)] as [number, number],
          }
        : undefined;

      // Build a lightweight context string by concatenating salient arrays/fields
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
      add("quotes", j.quotes);
      add("regionalNotes", j.regionalNotes);

      return {
        id,
        name,
        // `profile` optional since your JSON doesn't follow the old shape; we can synthesize a minimal one
        profile: {
          goals: j.goals ?? [],
          pains: j.pains ?? [],
          channels: j.channels ?? [],
          ethics: [], // none in JSON; leave empty
        },
        locale: j.locale ?? "es-MX",
        context: contextParts.join("\n"),
        bench,
      };
    }

    // Otherwise treat as Markdown with optional YAML frontmatter
    const { data, content } = matter(raw);
    return {
      id: data.id ?? id,
      name: data.name ?? id,
      profile: data.profile,
      locale: data.locale,
      context: (content ?? "").trim(),
      bench: data.bench, // if present in YAML
    };
  } catch (err) {
    return null;
  }
}

// Minimal fallback so MVP never blocks if files are missing
const FALLBACK: Record<string, Persona> = {
  nutriologa: {
    id: "nutriologa",
    name: "Nutrióloga",
    profile: {
      goals: ["Aumentar consultas"],
      pains: ["No-shows"],
      channels: ["Instagram", "WhatsApp"],
      ethics: ["Sin claims médicos"],
    },
    locale: "es-MX",
    context: "Contexto breve por defecto.",
  },
};

export async function getPersona(
  id: string,
  uploadedContext?: string
): Promise<Persona | null> {
  const file = await readPersonaFile(id);
  const base = file ?? FALLBACK[id] ?? null;
  if (!base) return null;

  // Build a light query for RAG ranking
  const query = [
    "persona:", base.name,
    "goals:", (base.profile?.goals ?? []).join(", "),
    "pains:", (base.profile?.pains ?? []).join(", "),
  ].join(" ");

  // Try to enrich with RAG (uses base + optional uploadedContext as corpus)
  const rag = await retrievePersonaContext({
    personaId: id,
    query,
    uploadedContext,
  });

  const context = rag?.combinedContext
    ? [rag.combinedContext, base.context].filter(Boolean).join("\n\n")
    : [base.context, uploadedContext?.trim()].filter(Boolean).join("\n\n");

  return { ...base, context };
}

export async function listPersonas(): Promise<{ id: string; name: string }[]> {
  try {
    const entries = await fs.readdir(DATA_DIR);
    const ids = entries.filter(e => e.endsWith(".md")).map(e => e.replace(".md", ""));
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
