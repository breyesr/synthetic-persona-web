"use client";

import { useEffect, useMemo, useState } from "react";
import PersonaSelect, { PersonaOption } from "./PersonaSelect";
import IndustrySelect from "./IndustrySelect";
import CitySelect from "./CitySelect";

type Scorecard = {
  efficiencyScore: number;
  narratives: string[];
  suggestedFocus?: "optimize_spend" | "improve_sales" | "change_channel" | "choose";
};

type PersonaReply = {
  reaction: string;
  dudasCliente: string[];
  sugerencias: string[];
  conversionLikelihood: number;
  personaName?: string;
  industryName?: string;
};

type Props = { personas?: PersonaOption[] };

// Channels (no Doctoralia)
const CHANNEL_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "google", label: "Google (Búsqueda/Maps)" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "referidos", label: "Recomendaciones" },
  { value: "otros", label: "Otros" },
];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const toInt = (v: string, fallback = 0) => {
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
};
const digitsOnly = (s: string) => s.replace(/[^\d]/g, "");
function isAllowedKey(e: React.KeyboardEvent<HTMLInputElement>) {
  const code = e.key;
  const allowed = ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
  if (allowed.includes(code)) return true;
  if ((e.ctrlKey || e.metaKey) && /^[acvxyz]$/i.test(code)) return true;
  return /^[0-9]$/.test(code);
}

export default function IntakeForm({ personas = [] }: Props) {
  // Persona
  const [personaType, setPersonaType] = useState<string>("");
  useEffect(() => {
    if (!personaType && personas[0]?.id) setPersonaType(personas[0].id);
    else if (personaType && !personas.find((p) => p.id === personaType)) {
      setPersonaType(personas[0]?.id ?? "");
    }
  }, [personas, personaType]);

  // Industry
  const [businessType, setBusinessType] = useState<string>("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Scorecard | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ----- FORM -----
  const [city, setCity] = useState("Monterrey");

  const [customersPerMonth, setCustomersPerMonth] = useState("");
  const [avgTicket, setAvgTicket] = useState("");
  const [adSpend, setAdSpend] = useState("");

  const [mainDiscovery, setMainDiscovery] = useState("instagram");
  const [supportChannels, setSupportChannels] = useState<string[]>([]);
  const toggleSupportChannel = (v: string) =>
    setSupportChannels((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const [repeatUnknown, setRepeatUnknown] = useState(false);
  const [repeatCount, setRepeatCount] = useState("0"); // 0..10

  function numberToBucket(n: number): "0-2" | "3-4" | "5-6" | "7-8" | "9-10" {
    const x = clamp(Math.round(n), 0, 10);
    if (x <= 2) return "0-2";
    if (x <= 4) return "3-4";
    if (x <= 6) return "5-6";
    if (x <= 8) return "7-8";
    return "9-10";
  }
  const preventWheel = (e: React.WheelEvent<HTMLInputElement>) => (e.currentTarget as any).blur();

  // Q&A focus buckets
  const [focus, setFocus] = useState<"efficiency" | "conversion" | "insight" | null>(null);
  const [question, setQuestion] = useState("");
  const [qnaLoading, setQnaLoading] = useState(false);
  const [qnaError, setQnaError] = useState<string | null>(null);
  const [personaAns, setPersonaAns] = useState<PersonaReply | null>(null);

  // Starter questions (customer POV)
  const starterQs = useMemo(() => {
    const medios = [
      "¿Dónde sueles buscar primero cuando necesitas algo como lo mío?",
      "¿Qué te haría dar clic en un anuncio mío sin dudar?",
      "¿Qué te hace ignorar por completo una publicación o anuncio?",
    ];
    const regreso = [
      "Después de comprar/visitar, ¿qué te haría volver pronto conmigo?",
      "Si no vuelves, ¿qué cosas suelen fallar o te desaniman?",
      "¿Qué señales te harían confiar más en mí para regresar?",
    ];
    const conocer = [
      "¿Qué problema intentas resolver exactamente conmigo?",
      "¿Qué te preocupa o te frena antes de decidirte?",
      "¿Qué información te gustaría tener clara desde el principio?",
    ];
    return { medios, regreso, conocer };
  }, []);

  // Validation
  const customersNum = toInt(customersPerMonth || "0", 0);
  const ticketNum = toInt(avgTicket || "0", 0);
  const spendNum = toInt(adSpend || "0", 0);
  const blockSubmit =
    !personaType ||
    !businessType ||
    customersPerMonth === "" ||
    avgTicket === "" ||
    adSpend === "" ||
    customersNum <= 0 ||
    ticketNum <= 0 ||
    spendNum <= 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (blockSubmit) {
      setError("Completa los campos con valores mayores a 0.");
      return;
    }
    const customers = clamp(customersNum, 0, 100000);
    const ticket = clamp(ticketNum, 0, 10_000_000);
    const spend = clamp(spendNum, 0, 10_000_000);
    const repeatVal = repeatUnknown ? "No sé" : numberToBucket(clamp(toInt(repeatCount, 0), 0, 10));

    const payload = {
      personaType,
      businessType,
      city,
      patientsPerMonth: customers,
      avgTicket: ticket,
      mainChannel: mainDiscovery,
      adSpend: spend,
      returnRate: repeatVal,
      supportChannels,
    };

    setLoading(true);
    setError(null);
    setResult(null);
    setPersonaAns(null);
    setQnaError(null);
    setFocus(null);

    try {
      const res = await fetch("/api/scorecard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: Scorecard = await res.json();
      setResult(json);

      switch (json.suggestedFocus) {
        case "optimize_spend": setFocus("efficiency"); break;
        case "improve_sales": setFocus("conversion"); break;
        case "change_channel": setFocus("insight"); break;
        default: setFocus(null);
      }
    } catch (err: any) {
      setError(err?.message ?? "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  async function askPersona(q: string) {
    if (!q?.trim()) return;
    if (!personaType) { setQnaError("Selecciona una persona antes de preguntar."); return; }
    if (!businessType) { setQnaError("Selecciona tu tipo de negocio."); return; }

    setQnaLoading(true);
    setQnaError(null);
    setPersonaAns(null);
    try {
      const res = await fetch("/api/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaType,
          businessType,
          city,
          question: q,
          focus: focus === "efficiency" ? "efficiency" : focus === "conversion" ? "conversion" : "insight",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const ans: PersonaReply = {
        reaction: json.reaction,
        dudasCliente: json.dudasCliente,
        sugerencias: json.sugerencias,
        conversionLikelihood: json.conversionLikelihood,
        personaName: json.persona,
        industryName: json.industry,
      };
      setPersonaAns(ans);
    } catch (err: any) {
      setQnaError(err?.message ?? "No pude obtener respuesta. Intenta de nuevo.");
    } finally {
      setQnaLoading(false);
    }
  }

  function handleStarterClick(s: string) {
    setQuestion(s); // select only
  }

  const noPersonas = personas.length === 0;

  return (
    <div className="w-full max-w-2xl p-4 rounded-2xl border border-gray-200 shadow-sm space-y-4">
      <h2 className="text-lg font-semibold">Aquí empieza tu crecimiento: cuéntanos sobre tu negocio</h2>

      {/* Persona + Industria + Ciudad */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <PersonaSelect
          options={personas}
          value={personaType}
          onChange={setPersonaType}
          labelText="¿Con quién quieres conectar y vender más?"
        />
        <IndustrySelect
          value={businessType}
          onChange={setBusinessType}
          labelText="¿Qué tipo de negocio tienes?"
        />
        <CitySelect value={city} onChange={setCity} labelText="Ciudad" />
      </div>

      {/* Form */}
      <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Clientes/mes */}
        <label className="space-y-1">
          <span className="text-sm">Clientes/mes</span>
          <input
            type="text"
            inputMode="numeric"
            className="w-full rounded-xl border p-2"
            value={customersPerMonth}
            onChange={(e) => setCustomersPerMonth(digitsOnly(e.target.value))}
            onKeyDown={(e) => { if (!isAllowedKey(e)) e.preventDefault(); }}
            onPaste={(e) => {
              const text = (e.clipboardData || (window as any).clipboardData).getData("text");
              if (!/^\d+$/.test(text)) e.preventDefault();
            }}
            onWheel={preventWheel}
            placeholder="Ej. 15"
          />
          {(customersPerMonth === "" || customersNum <= 0) && (
            <p className="text-xs text-red-600">Debes ingresar un número mayor a 0.</p>
          )}
        </label>

        {/* Ticket */}
        <label className="space-y-1">
          <span className="text-sm">Ticket promedio (MX$)</span>
          <input
            type="text"
            inputMode="numeric"
            className="w-full rounded-xl border p-2"
            value={avgTicket}
            onChange={(e) => setAvgTicket(digitsOnly(e.target.value))}
            onKeyDown={(e) => { if (!isAllowedKey(e)) e.preventDefault(); }}
            onPaste={(e) => {
              const text = (e.clipboardData || (window as any).clipboardData).getData("text");
              if (!/^\d+$/.test(text)) e.preventDefault();
            }}
            onWheel={preventWheel}
            placeholder="Ej. 300"
          />
          {(avgTicket === "" || ticketNum <= 0) && (
            <p className="text-xs text-red-600">Debes ingresar un número mayor a 0.</p>
          )}
        </label>

        {/* Main channel */}
        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm">¿Dónde te encuentran más?</span>
          <select
            className="w-full rounded-xl border p-2"
            value={mainDiscovery}
            onChange={(e) => setMainDiscovery(e.target.value)}
          >
            {CHANNEL_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </label>

        {/* Support channels */}
        <div className="sm:col-span-2 space-y-2">
          <p className="text-sm">¿Dónde más tienes presencia? (canales de apoyo)</p>
          <div className="flex flex-wrap gap-3">
            {CHANNEL_OPTIONS.map((c) => (
              <label key={`chk-${c.value}`} className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={supportChannels.includes(c.value)}
                  onChange={() => toggleSupportChannel(c.value)}
                />
                <span>{c.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Spend */}
        <label className="space-y-1">
          <span className="text-sm">Inversión mensual en anuncios (MX$)</span>
          <input
            type="text"
            inputMode="numeric"
            className="w-full rounded-xl border p-2"
            value={adSpend}
            onChange={(e) => setAdSpend(digitsOnly(e.target.value))}
            onKeyDown={(e) => { if (!isAllowedKey(e)) e.preventDefault(); }}
            onPaste={(e) => {
              const text = (e.clipboardData || (window as any).clipboardData).getData("text");
              if (!/^\d+$/.test(text)) e.preventDefault();
            }}
            onWheel={preventWheel}
            placeholder="Ej. 2000"
          />
          {(adSpend === "" || spendNum <= 0) && (
            <p className="text-xs text-red-600">Debes ingresar un número mayor a 0.</p>
          )}
        </label>

        {/* Repeat */}
        <div className="space-y-1">
          <span className="text-sm block">De 10 clientes nuevos, ¿cuántos vuelven / compran otra vez?</span>
          <div className="flex items-center gap-3">
            <input
              type="text"
              inputMode="numeric"
              className="w-28 rounded-xl border p-2"
              value={repeatCount}
              onChange={(e) => {
                const v = digitsOnly(e.target.value);
                if (v === "") setRepeatCount("0");
                else setRepeatCount(String(clamp(Number(v), 0, 10)));
              }}
              onKeyDown={(e) => { if (!isAllowedKey(e)) e.preventDefault(); }}
              onPaste={(e) => {
                const text = (e.clipboardData || (window as any).clipboardData).getData("text");
                if (!/^\d+$/.test(text)) e.preventDefault();
              }}
              onWheel={preventWheel}
              disabled={repeatUnknown}
              placeholder="0–10"
            />
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={repeatUnknown}
                onChange={(e) => setRepeatUnknown(e.target.checked)}
              />
              <span>No sé</span>
            </label>
          </div>
        </div>

        {/* Submit */}
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={loading || noPersonas || blockSubmit}
            className="rounded-xl bg-indigo-600 text-white px-4 py-2 text-sm disabled:opacity-60"
          >
            {loading ? "Calculando..." : "Generar scorecard"}
          </button>
          {(noPersonas || blockSubmit) && (
            <p className="mt-2 text-xs text-amber-700">
              {noPersonas ? "Carga al menos una persona para continuar." : "Completa los campos requeridos con valores mayores a 0."}
            </p>
          )}
        </div>
      </form>

      {error && <p className="text-sm text-red-600">Error: {error}</p>}

      {/* Results */}
      {result && (
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 text-gray-800 space-y-5">
          <h2 className="text-xl font-semibold">Tu resultado</h2>
          <div className="space-y-1">
            <p className="text-base">
              <span className="font-semibold">Eficiencia general:</span> {result.efficiencyScore}/10
            </p>
          </div>
          {!!result.narratives?.length && (
            <ul className="list-disc ml-5 text-sm text-gray-700 space-y-1">
              {result.narratives.map((line, i) => <li key={`narr-${i}`}>{line}</li>)}
            </ul>
          )}

          {/* Focus buttons (renamed per your wording) */}
          <div className="pt-2 border-t">
            <p className="text-sm mb-2">¿Qué quieres hacer ahora?</p>
            <div className="flex flex-wrap gap-2">
              <button
                className={`px-3 py-1.5 rounded-xl text-sm border ${focus === "efficiency" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-800"}`}
                onClick={() => setFocus("efficiency")}
              >
                Mejorar mi estrategia de publicidad
              </button>
              <button
                className={`px-3 py-1.5 rounded-xl text-sm border ${focus === "conversion" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-800"}`}
                onClick={() => setFocus("conversion")}
              >
                Lograr más clientes de regreso
              </button>
              <button
                className={`px-3 py-1.5 rounded-xl text-sm border ${focus === "insight" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-800"}`}
                onClick={() => setFocus("insight")}
              >
                Conocer mejor a mis clientes
              </button>
            </div>
          </div>

          {/* Q&A */}
          <div className="space-y-3">
            {focus && (
              <>
                <p className="text-sm text-gray-900">
                  Pregunta a {personaAns?.personaName ?? personas.find(p => p.id === personaType)?.name ?? "tu cliente"}
                </p>
                <div className="flex flex-col gap-2">
                  {(focus === "efficiency" ? starterQs.medios
                    : focus === "conversion" ? starterQs.regreso
                    : starterQs.conocer
                  ).map((s, idx) => (
                    <button
                      key={`sq-${idx}`}
                      className="text-left text-sm px-3 py-2 rounded-xl border hover:bg-gray-50"
                      onClick={() => handleStarterClick(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Escribe tu pregunta…"
                    className="flex-1 rounded-xl border p-2 text-sm"
                  />
                  <button
                    onClick={() => askPersona(question)}
                    disabled={!question || qnaLoading}
                    className="rounded-xl bg-indigo-600 text-white px-4 py-2 text-sm disabled:opacity-60"
                  >
                    {qnaLoading ? "Preguntando…" : "Preguntar"}
                  </button>
                </div>
                {qnaError && <p className="text-sm text-red-600">Error: {qnaError}</p>}
              </>
            )}

            {personaAns && (
              <div className="mt-2 rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Respuestas de {personaAns.personaName ?? "tu cliente"} tu cliente de {personaAns.industryName ?? businessType} en {city}
                </h3>

                <div className="space-y-3">
                  <div>
                    <p className="font-medium text-sm text-gray-900">
                      Dudas de {personaAns.personaName ?? "la persona"}
                    </p>
                    <ul className="list-disc ml-5 text-sm text-gray-700 space-y-1">
                      {personaAns.dudasCliente.map((d, i) => <li key={`duda-${i}`}>{d}</li>)}
                    </ul>
                  </div>

                  <div>
                    <p className="font-medium text-sm text-gray-900">
                      Qué le daría confianza a {personaAns.personaName ?? "la persona"}
                    </p>
                    <ul className="list-disc ml-5 text-sm text-gray-700 space-y-1">
                      {personaAns.sugerencias.map((s, i) => <li key={`sug-${i}`}>{s}</li>)}
                    </ul>
                  </div>

                  <div>
                    <p className="font-medium text-sm text-gray-900">Probabilidad de comprar</p>
                    <p className="text-sm text-gray-900">{personaAns.conversionLikelihood}/10</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}