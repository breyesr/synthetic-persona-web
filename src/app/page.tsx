// app/page.tsx
import fs from "fs";
import path from "path";
import IntakeForm from "@/components/IntakeForm";

function loadPersonas() {
  const dir = path.join(process.cwd(), "data", "personas");
  let personas: { id: string; name: string }[] = [];

  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const id = file.replace(/\.json$/, "");
      const raw = fs.readFileSync(path.join(dir, file), "utf8");
      const parsed = JSON.parse(raw);
      const name = parsed?.name ?? id;
      personas.push({ id, name });
    }
  } catch {
    personas = [];
  }

  return personas;
}

export default function HomePage() {
  const personas = loadPersonas();

  return (
    <main className="min-h-screen w-full flex items-start justify-center p-6">
      <div className="w-full max-w-3xl">
        <h1 className="text-2xl font-semibold mb-4">Synthetic Buyer Persona</h1>
        <IntakeForm personas={personas} />
      </div>
    </main>
  );
}