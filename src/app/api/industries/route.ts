// src/app/api/industries/route.ts
import { NextResponse } from "next/server";
import { listIndustries } from "@/lib/industryProvider";

export const runtime = "nodejs";

export async function GET() {
  try {
    const all = await listIndustries();
    const payload = all.map(i => ({ id: i.id, name: i.name }));
    return new NextResponse(JSON.stringify(payload), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // avoid any middle cache layers in dev
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}