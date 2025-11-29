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
  role?: string;
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
  const personaDir = path.join(DATA_DIR, id);
  const personaFile = path.join(personaDir, 'persona.json');

  try {
    const raw = await fs.readFile(personaFile, "utf8");
    const trimmed = raw.trim();

    if (trimmed.startsWith("{")) {
      const j = JSON.parse(trimmed);
      const name: string = j.name ?? id;
      const role: string | undefined = j.role;
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
        role,
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
      role: data.role,
      profile: data.profile,
      locale: data.locale,
      context: (content ?? "").trim(),
      bench: data.bench,
    };
  } catch {
    return null;
  }
}

export async function getPersona(id: string, userQuery: string): Promise<Persona | null> {
  const file = await readPersonaFile(id);
  if (!file) return null;

  // Use the user's query for hybrid search to get relevant context
  const searchResults = await hybridSearch(userQuery, id);
  const ragContext = searchResults.map(r => r.content).join("\n\n");

  // Combine the dynamic RAG context with the static context from the persona file
  const context = [ragContext, file.context].filter(Boolean).join("\n\n");

  return { ...file, context };
}

async function findPersonaFiles(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    let files: string[] = [];
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files = files.concat(await findPersonaFiles(fullPath));
        } else if (entry.name === 'persona.json') {
            files.push(fullPath);
        }
    }
    return files;
}

export async function listPersonas(): Promise<{ id: string; name: string; role?: string }[]> {
    try {
        const personaFiles = await findPersonaFiles(DATA_DIR);
        const metas = await Promise.all(
            personaFiles.map(async (file) => {
                const id = path.dirname(file).substring(DATA_DIR.length + 1);
                const p = await readPersonaFile(id);
                return p ? { id: p.id, name: p.name, role: p.role } : null;
            })
        );

        const existing = metas.filter(Boolean) as { id: string; name: string; role?: string }[];
        
        return existing;
    } catch (err) {
        console.error("Failed to list personas", err);
        return []; // Return empty array if error occurs
    }
}

export async function getPersonaKnowledgeFiles(personaId: string): Promise<string[]> {
  const knowledgeDir = path.join(DATA_DIR, personaId, 'knowledge');
  try {
    const files = await fs.readdir(knowledgeDir);
    return files.map(file => path.basename(file));
  } catch (error) {
    return [];
  }
}
