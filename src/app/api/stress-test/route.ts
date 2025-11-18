// src/app/api/stress-test/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { getPersona } from "@/lib/personaProvider";
import {
  buildStressSystemPrompt,
  buildStressUserMessage,
  describeFocus,
} from "./prompt";
import { getChallengeLevel } from "@/lib/challengeLevels";

export const runtime = "nodejs";

const Body = z.object({
  personaType: z.string(),
  challengeLevelId: z.string(),
  idea: z.string().min(10),
  goal: z.string().min(5),
  evaluationFocus: z.string().min(5),
});

const StressResponse = z.object({
  summary: z.string(),
  strengths: z.array(z.string()).min(1).max(5),
  gaps: z.array(z.string()).min(1).max(5),
  improvements: z.array(z.string()).min(2).max(5),
  questions: z.array(z.string()).min(2).max(5),
  confidence: z.number().int().min(0).max(100),
  tone: z.string().optional(),
});

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const body = Body.parse(await req.json());
    const persona = await getPersona(body.personaType);
    if (!persona) {
      return NextResponse.json(
        { error: "Persona not found" },
        { status: 404 }
      );
    }

    const challengeLevel = await getChallengeLevel(body.challengeLevelId);
    if (!challengeLevel) {
      return NextResponse.json(
        { error: "Challenge level not found" },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey });
    const focusMeta = describeFocus(body.evaluationFocus);
    const system = buildStressSystemPrompt({
      personaName: persona.name,
      personaContext: persona.context,
      level: challengeLevel,
      focusLabel: focusMeta.label,
    });
    const user = buildStressUserMessage({
      idea: body.idea,
      goal: body.goal,
      evaluationFocusKey: focusMeta.label,
    });

    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = StressResponse.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Malformed model output", details: parsed.error.format() },
        { status: 500 }
      );
    }

    return NextResponse.json({
      persona: persona.name,
      challengeLevel: challengeLevel.intensity,
      challengeLevelId: challengeLevel.id,
      challengeLabel: challengeLevel.name,
      challengeDetail: challengeLevel.detail,
      focus: focusMeta.label,
      ...parsed.data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to evaluate";
    console.error("[stress-test] error", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
