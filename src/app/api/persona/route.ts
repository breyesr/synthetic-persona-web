// app/api/persona/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPersona } from "@/lib/personaProvider";
export const runtime = "nodejs";

const Body = z.object({
  personaType: z.string(),
  city: z.string().optional(),
  question: z.string().optional(),
  focus: z.enum(["efficiency", "conversion"]).optional(),
  personaContext: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const persona = await getPersona(body.personaType, body.personaContext);
    if (!persona) {
      return NextResponse.json({ error: "Persona not found" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      persona: persona.name,
      contextPreview: persona.context.slice(0, 120),
      bench: persona.bench ?? null, // ← include benchmarks from file
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Bad request" },
      { status: 400 }
    );
  }
}
