// src/app/api/copywriter/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import fs from "fs/promises";
import path from "path";
import { getPersona } from "@/lib/personaProvider";
import { randomUUID } from "crypto";
import { db } from "@/lib/clients";

export const runtime = "nodejs";

type PlatformFile = {
  id: string;
  name: string;
  icon?: string;
  platform_purpose?: string;
  core_voice?: string;
  tone_adaptation?: string;
  copy_guidelines_summary?: string;
  global_guidelines?: Record<string, any>;
};

type FormatFile = {
  id: string;
  platform_id: string;
  name: string;
  includes_formats?: string[];
  content_type_group?: string;
  primary_goal_vibe?: string;
  tone_preference?: string;
  copy_guidelines?: Record<string, any>;
  on_screen_text_guidelines?: Record<string, any>;
  hashtags_mentions?: Record<string, any>;
  technical_constraints?: Record<string, any>;
  required_elements?: string[];
  output_fields?: string[];
  disallowed_practices?: string[];
  sub_format_emphasis_rules?: Record<string, any>;
};

type PlatformWithFormats = PlatformFile & { formats: FormatFile[] };

const PATHS = {
  platformsRoot: path.join(
    process.cwd(),
    "data",
    "copywriter",
    "digital-platforms"
  ),
  companyGuidelinesDir: path.join(
    process.cwd(),
    "data",
    "global-knowledge",
    "company-guidelines"
  ),
};

const RequestSchema = z.object({
  personaType: z.string(),
  context: z.string().optional().default(""),
  message: z.string().min(5),
  goal: z.string().min(5),
  platforms: z.array(z.string()).min(1),
  formats: z.array(z.string()).min(1),
});

const OutputSchema = z.object({
  outputs: z.array(
    z.object({
      platformId: z.string(),
      platformName: z.string(),
      formatId: z.string(),
      formatName: z.string(),
      primaryCopy: z.string(),
      alternateCopy: z.string().optional(),
      hashtags: z.array(z.string()).optional(),
      cta: z.string().optional(),
      notes: z.array(z.string()).optional(),
    })
  ),
});

async function logUsageToDb(payload: {
  event: string;
  persona: string;
  platforms: string[];
  formats: string[];
  goal: string;
  message: string;
  context?: string;
}) {
  try {
    const id = randomUUID();
    await db.query(
      `INSERT INTO usage_logs (id, event, persona_name, confidence_score, input_idea, goal, verdict, payload)
       VALUES ($1, $2, $3, NULL, $4, $5, NULL, $6::jsonb)`,
      [
        id,
        payload.event,
        payload.persona,
        payload.message,
        payload.goal,
        JSON.stringify(payload),
      ]
    );
  } catch (err) {
    console.error("[copywriter] log insert error", err);
  }
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function loadCompanyGuidelines(): Promise<Record<string, any>> {
  try {
    const entries = await fs.readdir(PATHS.companyGuidelinesDir, {
      withFileTypes: true,
    });
    const candidate = entries.find(
      (entry) =>
        entry.isFile() &&
        entry.name.toLowerCase().endsWith(".json") &&
        !entry.name.startsWith(".")
    );
    if (!candidate) {
      return {};
    }
    const filePath = path.join(PATHS.companyGuidelinesDir, candidate.name);
    const parsed = await readJson<Record<string, any>>(filePath);
    return parsed ?? {};
  } catch {
    return {};
  }
}

async function loadPlatforms(): Promise<PlatformWithFormats[]> {
  try {
    const entries = await fs.readdir(PATHS.platformsRoot, {
      withFileTypes: true,
    });

    const platforms: PlatformWithFormats[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

      const platformDir = path.join(PATHS.platformsRoot, entry.name);
      const platform = await readJson<PlatformFile>(
        path.join(platformDir, "platform.json")
      );
      if (!platform) continue;

      const formatsDir = path.join(platformDir, "formats");
      let formats: FormatFile[] = [];
      try {
        const formatFiles = await fs.readdir(formatsDir, {
          withFileTypes: true,
        });
        const jsonFiles = formatFiles.filter(
          (f) =>
            f.isFile() &&
            f.name.toLowerCase().endsWith(".json") &&
            !f.name.startsWith(".")
        );
        const parsedFormats = await Promise.all(
          jsonFiles.map((file) =>
            readJson<FormatFile>(path.join(formatsDir, file.name))
          )
        );
        formats = parsedFormats.filter(Boolean) as FormatFile[];
      } catch {
        formats = [];
      }

      platforms.push({ ...platform, formats });
    }

    return platforms;
  } catch {
    return [];
  }
}

function buildPrompt(options: {
  personaName: string;
  personaContext?: string;
  messageContext?: string;
  message: string;
  goal: string;
  companyGuidelines: Record<string, any>;
  platforms: PlatformWithFormats[];
  selectedPlatformIds: string[];
  selectedFormats: FormatFile[];
}) {
  const selectedPlatforms = options.platforms.filter((p) =>
    options.selectedPlatformIds.includes(p.id)
  );

  const selectedPairs = options.selectedFormats
    .map(
      (f, idx) =>
        `${idx + 1}. ${f.platform_id} :: ${f.id} (${f.name})`
    )
    .join("\n");

  const platformDetails = selectedPlatforms
    .map(
      (p) => `
Platform: ${p.name} (${p.id})
- Purpose: ${p.platform_purpose ?? "n/a"}
- Core voice: ${p.core_voice ?? "n/a"}
- Tone adaptation: ${p.tone_adaptation ?? "n/a"}
- Copy summary: ${p.copy_guidelines_summary ?? "n/a"}
- Global guidelines: ${JSON.stringify(p.global_guidelines ?? {}, null, 2)}
`.trim()
    )
    .join("\n\n");

  const formatDetails = options.selectedFormats
    .map(
      (f) => `
Format: ${f.name} (${f.id}) on ${f.platform_id}
- Goal/vibe: ${f.primary_goal_vibe ?? "n/a"}
- Tone preference: ${f.tone_preference ?? "n/a"}
- Copy guidelines: ${JSON.stringify(f.copy_guidelines ?? {}, null, 2)}
- On-screen text: ${JSON.stringify(
        f.on_screen_text_guidelines ?? {},
        null,
        2
      )}
- Hashtags/mentions: ${JSON.stringify(f.hashtags_mentions ?? {}, null, 2)}
- Technical: ${JSON.stringify(f.technical_constraints ?? {}, null, 2)}
- Required elements: ${(f.required_elements ?? []).join("; ")}
- Output fields: ${(f.output_fields ?? []).join("; ")}
- Disallowed: ${(f.disallowed_practices ?? []).join("; ")}
`.trim()
    )
    .join("\n\n");

  return `
You are a senior marketing copywriter. Write platform-native copy that strictly follows the platform and format guidelines, plus company rules.

Audience persona:
${options.personaName}
Context: ${options.personaContext ?? "(no extra context)"}

Company guidelines (brand voice, banned phrases, CTA norms):
${JSON.stringify(options.companyGuidelines, null, 2)}

Additional context:
${options.messageContext || "(none provided)"}

User request (what to say): ${options.message}
Goal/objective: ${options.goal}

Platform guidelines:
${platformDetails}

Format guidelines:
${formatDetails}

Selected platform-format targets (produce one output for each, in order):
${selectedPairs}

Instructions:
- Obey platform and format constraints (tone, length, hashtag policy, technical notes).
- Honor company banned phrases; do not include them.
- Make copy specific; avoid generic hype.
- Return exactly ${options.selectedFormats.length} outputs, one per selected format id above, in the same order. Do not skip any.
- If information feels sparse, still produce best-effort compliant copy rather than omitting the output.
- Provide outputs only for the selected platform-format pairs.
- Include hashtags only if they fit the platform guidance.
- Be concise; front-load hooks per platform best practices.

Return JSON with this shape:
{
  "outputs": [
    {
      "platformId": "<id>",
      "platformName": "<name>",
      "formatId": "<id>",
      "formatName": "<name>",
      "primaryCopy": "<the main copy or caption>",
      "alternateCopy": "<optional alt copy>",
      "hashtags": ["#tag1", "#tag2"],
      "cta": "<one CTA>",
      "notes": ["<constraints or reminders applied>"]
    }
  ]
}

Return only JSON.`;
}

export async function GET() {
  const platforms = await loadPlatforms();
  const companyGuidelines = await loadCompanyGuidelines();

  return NextResponse.json({ platforms, companyGuidelines });
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
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      personaType,
      message,
      context,
      goal,
      platforms: platformIds,
      formats,
    } = parsed.data;

    const [platforms, companyGuidelines, persona] = await Promise.all([
      loadPlatforms(),
      loadCompanyGuidelines(),
      getPersona(personaType, [context, message].filter(Boolean).join(" ")),
    ]);

    if (!persona) {
      return NextResponse.json(
        { error: "Persona not found" },
        { status: 404 }
      );
    }

    const platformMap = new Map(platforms.map((p) => [p.id, p]));
    const selectedPlatforms = platformIds
      .map((id) => platformMap.get(id))
      .filter(Boolean) as PlatformWithFormats[];

    if (selectedPlatforms.length === 0) {
      return NextResponse.json(
        { error: "No valid platforms provided" },
        { status: 400 }
      );
    }

    const formatMap = new Map<string, FormatFile>();
    platforms.forEach((p) => {
      p.formats.forEach((f) => {
        formatMap.set(f.id, f);
      });
    });

    const selectedFormats = formats
      .map((id) => formatMap.get(id))
      .filter(
        (f): f is FormatFile =>
          Boolean(f) && platformIds.includes(f!.platform_id)
      );

    if (selectedFormats.length === 0) {
      return NextResponse.json(
        { error: "No valid formats for selected platforms" },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey });
    const prompt = buildPrompt({
      personaName: persona.name,
      personaContext: persona.context,
      message,
      messageContext: context,
      goal,
      companyGuidelines,
      platforms,
      selectedPlatformIds: platformIds,
      selectedFormats,
    });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: "Generate the copy following the platform and format requirements.",
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsedOutput = OutputSchema.safeParse(JSON.parse(raw));

    if (!parsedOutput.success) {
      return NextResponse.json(
        {
          error: "Malformed model output",
          details: parsedOutput.error.format(),
        },
        { status: 500 }
      );
    }

    // Structured log for audit
    console.log(
      JSON.stringify(
        {
          event: "copywriter_generated",
          timestamp: new Date().toISOString(),
          persona: persona.name,
          platforms: platformIds,
          formats,
          goal,
          message,
          context,
        },
        null,
        2
      )
    );

    // Persist usage log (best-effort, non-blocking)
    logUsageToDb({
      event: "copywriter_generated",
      persona: persona.name,
      platforms: platformIds,
      formats,
      goal,
      message,
      context,
    }).catch(() => {});

    return NextResponse.json({
      persona: persona.name,
      goal,
      message,
      context,
      outputs: parsedOutput.data.outputs,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate copy";
    console.error("[copywriter] error", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
