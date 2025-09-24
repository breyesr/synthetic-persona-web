// src/app/page.tsx
import PersonaSelect, { PersonaOption } from "@/components/PersonaSelect";
import IntakeForm from "@/components/IntakeForm";
import { listPersonas } from "@/lib/personaProvider";

export default async function HomePage() {
  const people = await listPersonas();
  const options: PersonaOption[] = people.map((p) => ({
    id: p.id,
    name: p.name,
  }));

  return (
    <main className="min-h-screen w-full flex items-start justify-center p-6">
      <div className="w-full max-w-2xl space-y-8">
        <h1 className="text-2xl font-semibold">Synthetic Persona — MVP</h1>

        {/* Step 1: Persona Select */}
        <PersonaSelect options={options} />

        {/* Step 2: Intake Form */}
        <IntakeForm />
      </div>
    </main>
  );
}
