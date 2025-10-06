// src/app/consultas/page.tsx
"use client";

import { useEffect, useState } from "react";
import PersonaSelect, { PersonaOption } from "@/components/PersonaSelect";
import IndustrySelect from "@/components/IndustrySelect";

type PersonaReply = {
  reaction: string;
  answerToQuestion: string;
  dudasCliente: string[];
  sugerencias: string[];
  conversionLikelihood: number;
  persona?: string;
  industry?: string;
};

export default function ConsultasPage() {
  const [personas, setPersonas] = useState<PersonaOption[]>([]);
  const [personaType, setPersonaType] = useState<string>("");
  const [businessType, setBusinessType] = useState<string>("");
  const [question, setQuestion] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<PersonaReply | null>(null);

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
        if (!cancelled) setError(e?.message ?? "No se pudieron cargar las personas.");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const disabled = !personaType || !businessType || !question.trim() || loading;
  const personaName = personas.find((p) => p.id === personaType)?.name ?? "la persona";

  async function onAsk() {
    if (disabled) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch("/api/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaType,
          businessType,
          city: "",
          question,
          focus: "insight",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const payload: PersonaReply = {
        reaction: json.reaction,
        answerToQuestion: json.answerToQuestion,
        dudasCliente: json.dudasCliente ?? [],
        sugerencias: json.sugerencias ?? [],
        conversionLikelihood: json.conversionLikelihood ?? 0,
        persona: json.persona,
        industry: json.industry,
      };
      setAnswer(payload);
    } catch (e: any) {
      setError(e?.message ?? "No se pudo obtener respuesta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen py-10">
      <div className="mx-auto w-full max-w-4xl px-4 space-y-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Habla con una Persona Sintética
          </h1>
          <p className="text-sm text-gray-300">
            Selecciona una persona y tu industria, escribe tu pregunta y obtén una respuesta en primera persona.
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

          <div className="space-y-2">
            <label className="text-sm text-gray-200 block">
              Escríbele a {personaName}
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={5}
              className="w-full rounded-2xl border border-white/10 bg-white/90 p-4 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={`Soy ${personaName}. Pregúntame algo para empezar — puedo evaluar ideas, servicios o productos; también darte ideas de cómo ofrecerme tus productos/servicios.`}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={onAsk}
              disabled={disabled}
              className="rounded-xl px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {loading ? "Preguntando…" : `Preguntarle a ${personaName}`}
            </button>
            {error && <span className="text-sm text-rose-300">Error: {error}</span>}
          </div>
        </section>

        {answer && (
          <section className="rounded-2xl border border-white/10 bg-white p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-semibold text-gray-900">
                Respuesta de {answer.persona ?? personaName}
                {answer.industry ? ` — ${answer.industry}` : ""}
              </h2>
              <div className="flex gap-2">
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                  Persona
                </span>
                {answer.industry && (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    {answer.industry}
                  </span>
                )}
              </div>
            </div>

            {answer.answerToQuestion && (
              <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-800 leading-relaxed">
                {answer.answerToQuestion}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="font-medium text-sm text-gray-900 mb-1">Dudas</p>
                <ul className="list-disc ml-5 text-sm text-gray-700 space-y-1">
                  {answer.dudasCliente.map((d, i) => (
                    <li key={`d-${i}`}>{d}</li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="font-medium text-sm text-gray-900 mb-1">Qué le daría confianza</p>
                <ul className="list-disc ml-5 text-sm text-gray-700 space-y-1">
                  {answer.sugerencias.map((s, i) => (
                    <li key={`s-${i}`}>{s}</li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="font-medium text-sm text-gray-900 mb-1">Probabilidad de comprar</p>
                <div className="text-sm text-gray-900">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{answer.conversionLikelihood}/10</span>
                    <div className="h-2 w-28 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className="h-full bg-indigo-600"
                        style={{ width: `${Math.min(100, Math.max(0, answer.conversionLikelihood * 10))}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}