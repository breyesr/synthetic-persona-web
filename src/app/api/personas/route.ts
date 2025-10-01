// app/api/personas/route.ts
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

export async function GET() {
  try {
    const dir = path.join(process.cwd(), "data", "personas");
    const files = await fs.readdir(dir).catch(() => []);
    const options = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const id = file.replace(/\.json$/i, "");
      try {
        const raw = await fs.readFile(path.join(dir, file), "utf8");
        const parsed = JSON.parse(raw);
        const name = (parsed?.name ?? id).toString();
        options.push({ id, name });
      } catch {
        // skip malformed file
      }
    }

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