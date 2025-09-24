import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { ACTION_CARD_SYSTEM, buildActionCardUserPrompt } from "@/prompts/action-card";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const Req = z.object({
  personaType: z.enum(["nutriologa","odontologa","psicologo","fisioterapeuta","estetica"]),
  city: z.string(),
  focus: z.enum(["efficiency","conversion"]),
  intake: z.record(z.any()),
  scorecard: z.object({
    efficiencyScore: z.number(),
    conversionScore: z.number(),
    objections: z.array(z.string()),
    suggestions: z.array(z.string()),
  }),
  personaAnswer: z.object({
    reaction: z.string(),
    objections: z.array(z.string()),
    suggestions: z.array(z.string()),
    conversionLikelihood: z.number(),
  }),
});

const Resp = z.object({
  diy: z.object({
    steps: z.array(z.string()).min(3).max(4),
    scripts: z.array(z.object({ label: z.string(), text: z.string() })).min(1).max(3),
  }),
  agency: z.array(z.string()).min(3).max(5),
  why: z.string().min(10),
  impactScore: z.number().int().min(0).max(10),
});

async function call(system: string, user: string) {
  const r = await client.chat.completions.create({
    model: MODEL, temperature: 0.3,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    response_format: { type: "json_object" },
  });
  return JSON.parse(r.choices[0].message.content || "{}");
}

export async function POST(req: NextRequest) {
  try {
    const body = Req.parse(await req.json());
    const userPrompt = buildActionCardUserPrompt(body);

    let json = await call(ACTION_CARD_SYSTEM, userPrompt);
    try { return NextResponse.json(Resp.parse(json)); }
    catch {
      json = await call(ACTION_CARD_SYSTEM + "\nDevuelve SOLO JSON válido.", userPrompt);
      return NextResponse.json(Resp.parse(json));
    }
  } catch (e:any) {
    return NextResponse.json({ error: e.message ?? "action_failed" }, { status: 400 });
  }
}