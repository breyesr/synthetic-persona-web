// src/app/api/challenge-levels/route.ts
import { NextResponse } from "next/server";
import { listChallengeLevels } from "@/lib/challengeLevels";

export const runtime = "nodejs";

export async function GET() {
  try {
    const levels = await listChallengeLevels();
    const payload = levels.map((lvl) => ({
      id: lvl.id,
      name: lvl.name,
      detail: lvl.detail,
      intensity: lvl.intensity,
    }));
    return NextResponse.json({ options: payload });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load challenge levels";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
