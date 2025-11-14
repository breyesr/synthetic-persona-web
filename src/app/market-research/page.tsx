// src/app/market-research/page.tsx
"use client";

import { useEffect, useState } from "react";
import PersonaSelect, { PersonaOption } from "@/components/PersonaSelect";

type BerumenReply = {
  persona?: string;
  industry?: string;
  city?: string;
  question: string;
  client: {
    answer: string;
    tone?: string;
    keyPoints: string[];
  };
  consultant: {
    analysis: string;
    recommendations: string[];
    followUps: string[];
  };
  confidence: number;
};

const LOCKED_INDUSTRY_ID = "investigacionMercados";

export default function MarketResearchPage() {
  const [personas, setPersonas] = useState<PersonaOption[]>([]);
  const [personaNames, setPersonaNames] = useState<Record<string, string>>({});
  const [personaType, setPersonaType] = useState<string>("");
  const [industryLabel, setIndustryLabel] = useState("Investigación de mercados");
  const [question, setQuestion] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<BerumenReply | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPersonas = async () => {
      try {
        const res = await fetch("/api/personas/berumen", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list: Array<{ id: string; name: string; role?: string }> = Array.isArray(data)
          ? data
          : Array.isArray(data?.options)
            ? data.options
            : [];
        if (!cancelled) {
          const lookup: Record<string, string> = {};
          const selectOptions: PersonaOption[] = list.map((item) => {
            lookup[item.id] = item.name;
            return {
              id: item.id,
              name: item.role?.trim() ? item.role : item.name,
            };
          });
          setPersonas(selectOptions);
          setPersonaNames(lookup);
          setPersonaType((prev) => prev || selectOptions[0]?.id || "");
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "No se pudieron cargar las personas.";
          setError(message);
        }
      }
    };

    const loadIndustry = async () => {
      try {
        const res = await fetch("/api/industries", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list: { id: string; name: string }[] = Array.isArray(data) ? data : [];
        const entry = list.find((item) => item.id === LOCKED_INDUSTRY_ID);
        if (!cancelled && entry?.name) setIndustryLabel(entry.name);
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "No se pudieron cargar las industrias.";
          setError(message);
        }
      }
    };

    loadPersonas();
    loadIndustry();

    return () => {
      cancelled = true;
    };
  }, []);

  const disabled = !personaType || !question.trim() || loading;
  const personaName =
    answer?.persona ??
    personaNames[personaType] ??
    personas.find((p) => p.id === personaType)?.name ??
    "la persona";
  const industryName = answer?.industry ?? industryLabel;

  async function onAsk() {
    if (disabled) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch("/api/berumen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaType,
          businessType: LOCKED_INDUSTRY_ID,
          city: "",
          question,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setAnswer(json as BerumenReply);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo obtener respuesta.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen py-10">
      <div className="mx-auto w-full max-w-4xl px-4 space-y-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Market Research
          </h1>
          <p className="text-sm text-gray-300">
            Selecciona una persona y tu industria, escribe tu pregunta y obtén la voz del cliente junto con el análisis de un consultor de Berumen.
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
              <label className="text-xs uppercase tracking-wide text-gray-300">Industria</label>
              <input
                value={industryLabel}
                readOnly
                className="w-full rounded-xl border border-white/20 bg-white/90 p-3 text-sm text-gray-700 shadow-inner"
              />
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
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {personaName} — {industryName}
                </h2>
                <p className="text-sm text-gray-500">Pregunta: {answer.question}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                  Cliente
                </span>
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  Berumen
                </span>
                <div className="text-xs text-gray-600">
                  Confianza: <span className="font-semibold">{answer.confidence}%</span>
                </div>
              </div>
            </div>

            {/* Client voice */}
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-gray-900">Voz del cliente</h3>
              <p className="text-sm text-gray-500">
                Tono: {answer.client.tone ?? "—"}
              </p>
              <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-800 leading-relaxed">
                {answer.client.answer}
              </div>
              <div>
                <p className="font-medium text-sm text-gray-900 mb-1">Puntos clave</p>
                <ul className="list-disc ml-5 text-sm text-gray-700 space-y-1">
                  {answer.client.keyPoints.map((point, idx) => (
                    <li key={`client-key-${idx}`}>{point}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Consultant response */}
            <div className="space-y-3 border-t pt-4">
              <h3 className="text-base font-semibold text-gray-900">Consultor Berumen</h3>
              <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 leading-relaxed">
                {answer.consultant.analysis}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="font-medium text-sm text-gray-900 mb-1">Recomendaciones</p>
                  <ul className="list-disc ml-5 text-sm text-gray-700 space-y-1">
                    {answer.consultant.recommendations.map((rec, idx) => (
                      <li key={`rec-${idx}`}>{rec}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-900 mb-1">Preguntas de seguimiento</p>
                  <ul className="list-disc ml-5 text-sm text-gray-700 space-y-1">
                    {answer.consultant.followUps.map((fq, idx) => (
                      <li key={`fq-${idx}`}>{fq}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
