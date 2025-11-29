// src/app/api/personas/[id]/knowledge/route.ts
import { NextResponse } from "next/server";
import { getPersonaKnowledgeFiles } from "@/lib/personaProvider";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const knowledgeFiles = await getPersonaKnowledgeFiles(id);
    return NextResponse.json({ knowledgeFiles });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to load knowledge files for persona";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
