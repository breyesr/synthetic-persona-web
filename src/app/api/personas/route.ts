// app/api/personas/route.ts
import { NextResponse } from "next/server";
import { listPersonas } from "@/lib/personaProvider";

export const runtime = "nodejs";

export async function GET() {
  try {
    const options = await listPersonas();
    // sort by name for nicer UX
    options.sort((a, b) => a.name.localeCompare(b.name, "es"));
    return NextResponse.json({ options });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to list personas" },
      { status: 500 }
    );
  }
}