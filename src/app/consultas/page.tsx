// src/app/consultas/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useChat } from '@ai-sdk/react';
import PersonaSelect, { PersonaOption } from "@/components/PersonaSelect";
import IndustrySelect from "@/components/IndustrySelect";

type Source = {
  source_file: string;
  persona_id: string;
};

export default function ConsultasPage() {
  const [personas, setPersonas] = useState<PersonaOption[]>([]);
  const [personaType, setPersonaType] = useState<string>("");
  const [businessType, setBusinessType] = useState<string>("");
  const [initialError, setInitialError] = useState<string | null>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, data } = useChat({
    api: '/api/persona',
  });

  const sources = data?.find((d: any) => d.type === 'sources')?.sources as Source[] | undefined;
  const latestAssistantMessage = messages.find(m => m.role === 'assistant');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/personas", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list: PersonaOption[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.options)
          ? data.options
          : [];
        if (!cancelled) {
          setPersonas(list);
          if (list[0]?.id) setPersonaType(list[0].id);
        }
      } catch (e: any) {
        if (!cancelled) setInitialError(e?.message ?? "No se pudieron cargar las personas.");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);
  
  const personaName = personas.find((p) => p.id === personaType)?.name ?? "la persona";
  const disabled = !personaType || !businessType || !input.trim() || isLoading;

  const onAsk = (e: React.FormEvent<HTMLFormElement>) => {
    handleSubmit(e, {
      body: {
        personaType,
        // businessType is now unused in the simplified streaming API
        // but we can keep it here for future use.
        businessType,
      }
    })
  }

  return (
    <div className="min-h-screen py-10">
      <div className="mx-auto w-full max-w-4xl px-4 space-y-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Habla con una Persona Sintética (Streaming)
          </h1>
          <p className="text-sm text-gray-300">
            Selecciona una persona y tu industria, escribe tu pregunta y obtén una respuesta en tiempo real.
          </p>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5 shadow-sm space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-gray-300">Persona</label>
              <div className="rounded-xl bg-white text-gray-500">
                <PersonaSelect
                  options={personas}
                  value={personaType}
                  onChange={setPersonaType}
                  labelText=""
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-gray-300">Tu industria</label>
              <div className="rounded-xl bg-white text-gray-500">
                <IndustrySelect
                  value={businessType}
                  onChange={setBusinessType}
                  labelText=""
                />
              </div>
            </div>
          </div>

          <form onSubmit={onAsk} className="space-y-2">
            <label className="text-sm text-gray-200 block">
              Escríbele a {personaName}
            </label>
            <textarea
              value={input}
              onChange={handleInputChange}
              rows={5}
              className="w-full rounded-2xl border border-white/10 bg-white/90 p-4 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={`Soy ${personaName}. Pregúntame algo para empezar...`}
            />

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                disabled={disabled}
                className="rounded-xl px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {isLoading ? "Preguntando…" : `Preguntarle a ${personaName}`}
              </button>
              {(error || initialError) && <span className="text-sm text-rose-300 self-center">Error: {error?.message ?? initialError}</span>}
            </div>
          </form>
        </section>

        {(latestAssistantMessage || sources) && (
          <section className="rounded-2xl border border-white/10 bg-white p-6 shadow-sm space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">
              Respuesta
            </h2>
            
            {latestAssistantMessage && (
              <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                {latestAssistantMessage.content}
              </div>
            )}

            {sources && sources.length > 0 && (
              <div>
                <p className="font-medium text-sm text-gray-900 mb-2">Fuentes consultadas:</p>
                <div className="flex flex-wrap gap-2">
                  {sources.map((source, i) => (
                    <span key={`s-${i}`} className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                      {source.source_file.replace('data/personas/', '')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}