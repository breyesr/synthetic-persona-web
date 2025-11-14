// src/app/api/berumen/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { getPersona } from "@/lib/personaProvider";
import { getIndustry } from "@/lib/industryProvider";
import { buildBerumenSystemPrompt, buildBerumenUserMessage } from "./prompt";

export const runtime = "nodejs";

const Body = z.object({
  personaType: z.string(),
  businessType: z.string(),
  city: z.string().default(""),
  question: z.string().min(1),
});

const BerumenResponse = z.object({
  client: z.object({
    answer: z.string().min(1),
    tone: z.string().optional().default(""),
    keyPoints: z.array(z.string()).min(1).max(5),
  }),
  consultant: z.object({
    analysis: z.string().min(1),
    recommendations: z.array(z.string()).min(1).max(5),
    followUps: z.array(z.string()).min(1).max(3),
  }),
  confidence: z.number().int().min(0).max(100),
});

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export async function POST(req: Request) {
  if (!openai) {
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

    const industry = await getIndustry(body.businessType);
    const industryName = industry?.name ?? body.businessType;
    const city = body.city || "tu ciudad";

    const system = buildBerumenSystemPrompt({
      personaName: persona.name,
      industryName,
      city,
      personaContext: persona.context,
    });

    const businessSummary = `Industria: ${industryName}. Ciudad: ${city}.`;
    const user = buildBerumenUserMessage({
      question: body.question,
      businessSummary,
      personaSnapshot: persona.context,
    });

    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = BerumenResponse.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Malformed model output", details: parsed.error.format() },
        { status: 500 }
      );
    }

    return NextResponse.json({
      persona: persona.name,
      industry: industryName,
      city,
      question: body.question,
      ...parsed.data,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to generate insights",
      },
      { status: 400 }
    );
  }
}
