// app/api/cities/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

type City = { id: string; name: string };

const CitySchema = z.object({ id: z.string().min(1), name: z.string().min(1) });
const CitiesSchema = z.array(CitySchema);

async function loadCitiesFile(): Promise<City[]> {
  const filePath = path.join(process.cwd(), "data", "cities.json");
  try {
    const txt = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(txt);
    const cities = CitiesSchema.parse(parsed);
    // dedupe by id
    const seen = new Set<string>();
    const out: City[] = [];
    for (const c of cities) {
      const id = c.id.trim();
      const name = c.name.trim() || id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, name });
    }
    return out;
  } catch {
    // Safe fallback (keep a few major cities)
    return [
      { id: "Monterrey", name: "Monterrey" },
      { id: "CDMX", name: "Ciudad de México" },
      { id: "Guadalajara", name: "Guadalajara" },
      { id: "Mérida", name: "Mérida" },
      { id: "Cancún", name: "Cancún" },
    ];
  }
}

export async function GET() {
  try {
    const cities = await loadCitiesFile();
    return NextResponse.json(cities);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to load cities" }, { status: 500 });
  }
}