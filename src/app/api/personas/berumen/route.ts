// src/app/api/personas/berumen/route.ts
import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

const DATA_DIR = path.join(process.cwd(), "data", "personas", "berumen");

type Option = { id: string; name: string; role?: string };

export async function GET() {
  try {
    const entries = await fs.readdir(DATA_DIR);
    const options: Option[] = [];

    for (const entry of entries) {
      const full = path.join(DATA_DIR, entry);
      const stat = await fs.stat(full).catch(() => null);
      if (!stat || !stat.isFile()) continue;
      try {
        const raw = await fs.readFile(full, "utf8");
        const parsed = JSON.parse(raw);
        const name = typeof parsed?.name === "string" ? parsed.name : entry;
        const role =
          typeof parsed?.role === "string" && parsed.role.trim().length > 0
            ? parsed.role.trim()
            : undefined;
        const base = entry.replace(/\.json$/i, "");
        options.push({ id: `berumen/${base}`, name, role });
      } catch {
        // skip invalid JSON
      }
    }

    options.sort((a, b) => a.name.localeCompare(b.name, "es"));
    return NextResponse.json({ options });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load personas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
