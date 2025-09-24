// src/lib/ragSource.ts
// Server-only, DB-free RAG for MVP

import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import OpenAI from "openai";

type Chunk = { id: string; text: string };

const DATA_DIR = path.join(process.cwd(), "data", "personas");
const EMB_MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
const TOP_K = Number(process.env.RAG_TOP_K ?? 4);
const MAX_CTX_CHARS = 1800; // keep prompts lean per PRD token budget

function chunkText(raw: string): Chunk[] {
  const parts = raw
    .replace(/\r/g, "")
    .split(/\n{2,}/g)              // paragraphs
    .flatMap(p => p.match(/.{1,400}(\s+|$)/g) ?? []);
  return parts
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text, i) => ({ id: `c${i}`, text }));
}

async function loadPersonaMarkdown(personaId: string): Promise<string | null> {
  try {
    const file = await fs.readFile(path.join(DATA_DIR, `${personaId}.md`), "utf8");
    const { content } = matter(file);
    return (content ?? "").trim();
  } catch {
    return null;
  }
}

function cosineSim(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function retrievePersonaContext(opts: {
  personaId: string;
  query: string;              // e.g., persona goals/pains, focus
  uploadedContext?: string;   // optional user-supplied extras
}): Promise<{ combinedContext: string; usedChunks: Chunk[] } | null> {
  const base = await loadPersonaMarkdown(opts.personaId);
  if (!base && !opts.uploadedContext) return null;

  const corpus = [base ?? "", opts.uploadedContext ?? ""].filter(Boolean).join("\n\n");
  const chunks = chunkText(corpus);
  if (chunks.length === 0) return null;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Embed chunks
  const chunkEmb = await openai.embeddings.create({
    model: EMB_MODEL,
    input: chunks.map(c => c.text),
  });
  const vectors = chunkEmb.data.map(d => d.embedding as number[]);

  // Embed query
  const qEmb = await openai.embeddings.create({
    model: EMB_MODEL,
    input: opts.query,
  });
  const qv = qEmb.data[0].embedding as number[];

  // Rank by cosine similarity
  const ranked = chunks
    .map((c, i) => ({ chunk: c, score: cosineSim(vectors[i], qv) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K)
    .map(r => r.chunk);

  // Concatenate up to budget
  let combined = "";
  const used: Chunk[] = [];
  for (const c of ranked) {
    const next = combined ? combined + "\n\n" + c.text : c.text;
    if (next.length > MAX_CTX_CHARS) break;
    combined = next;
    used.push(c);
  }

  return { combinedContext: combined, usedChunks: used };
}
