// src/app/api/stress-test/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { randomUUID } from "crypto";
import { getPersona, Persona } from "@/lib/personaProvider";
import { getChallengeLevel, ChallengeLevel } from "@/lib/challengeLevels";
import { buildStressUserMessage, describeFocus } from "./prompt";
import { db } from "@/lib/clients";

export const runtime = "nodejs";

const Body = z.object({
  personaType: z.string(),
  challengeLevelId: z.string(),
  idea: z.string().min(10).max(1500),
  goal: z.string().min(5).max(300),
  evaluationFocus: z.string().min(5).max(300),
});

// 1. The Output Schema (as a Zod schema)
const SimulationResultSchema = z.object({
  confidenceScore: z.number().int().min(1).max(100),
  verdict: z.string(),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  actionPlan: z.array(z.string()),
  followUpQuestions: z.array(z.string()),
});

// 2. The New System Prompt (with the "Competence" Patch included)
function buildSystemPrompt(persona: Persona, challengeLevelData: ChallengeLevel): string {
  const challengeLevel = challengeLevelData.intensity;
  const levelNames = { 1: 'low', 2: 'medium', 3: 'high' } as const;
  const level = levelNames[challengeLevel as keyof typeof levelNames] || 'medium';

  let toneDescription = challengeLevelData.tone;
  if (typeof toneDescription === 'object' && toneDescription !== null) {
    toneDescription = (toneDescription as { style?: string }).style ?? JSON.stringify(toneDescription);
  }

  // Using persona context for expertise as a placeholder
  const expertise = persona.context.split('\n').slice(0, 2).join(', ');

  return `You are ${persona.name}, a ${persona.role}.
Your areas of expertise include: ${expertise}.
CHALLENGE LEVEL: ${challengeLevel} (${level} intensity)
Your tone should be: ${toneDescription}

You will analyze a business idea and provide structured, honest feedback from your expert perspective.

CRITICAL INSTRUCTIONS:
1. Stay in character - speak as ${persona.name} would
2. Focus on areas within your expertise
3. Be specific and actionable in your feedback
4. Adjust your critical intensity based on the challenge level
5. Generate natural, grammatically correct responses (no template-like language)
6. If the idea is outside your expertise, acknowledge that while still providing relevant insights
7. SCORING RUBRIC: Penalize vague ideas lacking specificity in budget, timeline, target audience, and measurable outcomes. If the plan is not concrete, default confidence should sit in the 30–50 range; only exceed 50 when those elements are clear.
// 8. SCORING CAP (commented for testing): If confidenceScore would exceed 70, require at least two concrete strengths tied to audience/budget/timeline; otherwise cap at 60.

Your response MUST be a valid JSON object with this exact structure:
{
  "confidenceScore": <number 1-100, where higher = more viable/confident in the idea>,
  "verdict": "<2-3 sentences summarizing your professional assessment>",
  "strengths": ["<specific strength 1>", "<specific strength 2>", "<specific strength 3>"],
  "gaps": ["<critical gap 1>", "<critical gap 2>", "<critical gap 3>", "<critical gap 4 if challenge level is high>"],
  "actionPlan": ["<actionable step 1>", "<actionable step 2>", "<actionable step 3>", "<actionable step 4>"],
  "followUpQuestions": ["<probing question 1>", "<probing question 2>", "<probing question 3>"]
}

CRITICAL: Return ONLY the JSON object. No markdown formatting, no code blocks.`;
}

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

async function logUsageToDb(payload: {
  event: string;
  persona: string;
  confidence: number;
  idea: string;
  goal: string;
  verdict: string;
}) {
  try {
    const id = randomUUID();
    await db.query(
      `INSERT INTO usage_logs (id, event, persona_name, confidence_score, input_idea, goal, verdict, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [
        id,
        payload.event,
        payload.persona,
        payload.confidence,
        payload.idea,
        payload.goal,
        payload.verdict,
        JSON.stringify(payload),
      ]
    );
  } catch (err) {
    console.error("[stress-test] log insert error", err);
  }
}

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
    const persona = await getPersona(body.personaType, body.idea);
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
    
    // Use the new system prompt
    const system = buildSystemPrompt(persona, challengeLevel);
    
    const user = buildStressUserMessage({
      idea: body.idea,
      goal: body.goal,
      evaluationFocusKey: focusMeta.label,
    });

    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = SimulationResultSchema.safeParse(JSON.parse(raw));

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Malformed model output", details: parsed.error.format() },
        { status: 500 }
      );
    }

    // 3. The Passthrough Normalization (No rigging)
    const confidenceScore = Math.min(100, Math.max(1, parsed.data.confidenceScore || 50));

    // Map new schema to old response structure for frontend compatibility
    const responsePayload = {
      persona: persona.name,
      challengeLevel: challengeLevel.intensity,
      challengeLevelId: challengeLevel.id,
      challengeLabel: challengeLevel.name,
      challengeDetail: challengeLevel.detail,
      focus: focusMeta.label,
      summary: parsed.data.verdict,
      strengths: parsed.data.strengths,
      gaps: parsed.data.gaps,
      improvements: parsed.data.actionPlan,
      questions: parsed.data.followUpQuestions,
      confidence: confidenceScore,
      // tone is part of prompt now, not response
    };

    // Non-blocking usage log to Vercel runtime logs
    console.log(
      JSON.stringify(
        {
          event: "stress_test_completed",
          timestamp: new Date().toISOString(),
          persona: persona.name,
          confidence_score: confidenceScore,
          input_idea: body.idea,
          verdict: parsed.data.verdict,
        },
        null,
        2
      )
    );

    // Persist usage log (best-effort, non-blocking)
    logUsageToDb({
      event: "stress_test_completed",
      persona: persona.name,
      confidence: confidenceScore,
      idea: body.idea,
      goal: body.goal,
      verdict: parsed.data.verdict,
    }).catch(() => {});

    return NextResponse.json(responsePayload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to evaluate";
    console.error("[stress-test] error", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
