// app/api/industries/route.ts
import { NextResponse } from "next/server";
import { listIndustries } from "@/lib/industryProvider";

export const runtime = "nodejs";

export async function GET() {
  try {
    const all = await listIndustries();
    return NextResponse.json(all.map(i => ({ id: i.id, name: i.name })));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}