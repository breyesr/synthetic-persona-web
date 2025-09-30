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
};

type Props = { personas?: PersonaOption[] };

// Channels (Doctoralia removed)
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

// Allow navigation & editing keys; block everything that isn’t a digit
function isAllowedKey(e: React.KeyboardEvent<HTMLInputElement>) {
  const code = e.key;
  const allowed = [
    "Backspace",
    "Delete",
    "Tab",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Home",
    "End",
  ];
  if (allowed.includes(code)) return true;
  // Allow Ctrl/Cmd + A/C/V/X/Z/Y
  if ((e.ctrlKey || e.metaKey) && /^[acvxyz]$/i.test(code)) return true;
  // Digits
  return /^[0-9]$/.test(code);
}

export default function IntakeForm({ personas = [] }: Props) {
  // Persona
  const [personaType, setPersonaType] = useState<string>("");
  const [personaName, setPersonaName] = useState<string>("la persona");
  useEffect(() => {
    if (!personaType && personas[0]?.id) {
      setPersonaType(personas[0].id);
      setPersonaName(personas[0].name);
    } else if (personaType) {
      const found = personas.find((p) => p.id === personaType);
      if (found) setPersonaName(found.name);
    }
  }, [personas, personaType]);

  // Industry
  const [businessType, setBusinessType] = useState<string>("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Scorecard | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ----- FORM (numeric inputs start EMPTY) -----
  const [city, setCity] = useState("Monterrey");
  const [customersPerMonth, setCustomersPerMonth] = useState(""); // empty by default
  const [avgTicket, setAvgTicket] = useState("");                  // empty by default
  const [adSpend, setAdSpend] = useState("");                      // empty by default

  const [mainDiscovery, setMainDiscovery] = useState("instagram");
  const [supportChannels, setSupportChannels] = useState<string[]>([]);
  const toggleSupportChannel = (v: string) =>
    setSupportChannels((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const [repeatUnknown, setRepeatUnknown] = useState(false);
  const [repeatCount, setRepeatCount] = useState("0"); // 0..10 when known

  function numberToBucket(n: number): "0-2" | "3-4" | "5-6" | "7-8" | "9-10" {
    const x = clamp(Math.round(n), 0, 10);
    if (x <= 2) return "0-2";
    if (x <= 4) return "3-4";
    if (x <= 6) return "5-6";
    if (x <= 8) return "7-8";
    return "9-10";
  }

  const preventWheel = (e: React.WheelEvent<HTMLInputElement>) => (e.currentTarget as any).blur();

  // Q&A state (include "insight")
  const [focus, setFocus] = useState<"efficiency" | "conversion" | "insight" | null>(null);
  const [question, setQuestion] = useState("");
  const [qnaLoading, setQnaLoading] = useState(false);
  const [qnaError, setQnaError] = useState<string | null>(null);
  const [personaAns, setPersonaAns] = useState<PersonaReply | null>(null);

  // Starter questions: customer-needs voice
  const starterQs = useMemo(() => {
    const insight = [
      "¿Qué necesitas para decidirte conmigo?",
      "¿Qué dudas tienes antes de comprar/contratarme?",
      "¿Qué haría que confíes más en mí?",
    ];
    const efficiency = [
      "¿Qué te confunde o te hace dudar del precio?",
      "¿Qué información te falta para sentir que vale la pena?",
      "¿Qué te haría dejar tus datos sin pensarlo mucho?",
    ];
    const conversion = [
      "¿Qué te haría volver después de la primera compra/consulta?",
      "¿Qué seguimiento te gustaría recibir y por dónde?",
      "¿Qué prueba te convencería de que voy por buen camino?",
    ];
    return { insight, efficiency, conversion };
  }, []);

  // Validation: must be > 0 and non-empty to submit
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
        case "optimize_spend":
          setFocus("efficiency");
          break;
        case "improve_sales":
          setFocus("conversion");
          break;
        case "change_channel":
          setFocus("insight"); // steer to learning
          break;
        default:
          setFocus("insight");
      }
    } catch (err: any) {
      setError(err?.message ?? "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  async function askPersona(q: string) {
    if (!q?.trim()) return;
    if (!personaType) {
      setQnaError("Selecciona una persona antes de preguntar.");
      return;
    }
    setQnaLoading(true);
    setQnaError(null);
    setPersonaAns(null);
    try {
      const res = await fetch("/api/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaType,
          city,
          question: q,
          focus: focus ?? "insight",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const ans: PersonaReply = {
        reaction: json.reaction,
        dudasCliente: json.dudasCliente,
        sugerencias: json.sugerencias,
        conversionLikelihood: json.conversionLikelihood,
      };
      setPersonaAns(ans);
    } catch (err: any) {
      setQnaError(err?.message ?? "No pude obtener respuesta. Intenta de nuevo.");
    } finally {
      setQnaLoading(false);
    }
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

      {/* Métricas y canales */}
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
            onKeyDown={(e) => {
              if (!isAllowedKey(e)) e.preventDefault();
            }}
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

        {/* Ticket promedio */}
        <label className="space-y-1">
          <span className="text-sm">Ticket promedio (MX$)</span>
          <input
            type="text"
            inputMode="numeric"
            className="w-full rounded-xl border p-2"
            value={avgTicket}
            onChange={(e) => setAvgTicket(digitsOnly(e.target.value))}
            onKeyDown={(e) => {
              if (!isAllowedKey(e)) e.preventDefault();
            }}
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

        {/* ¿Dónde te encuentran más? */}
        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm">¿Dónde te encuentran más?</span>
          <select
            className="w-full rounded-xl border p-2"
            value={mainDiscovery}
            onChange={(e) => setMainDiscovery(e.target.value)}
          >
            {CHANNEL_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        {/* Canales de apoyo */}
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

        {/* Inversión mensual */}
        <label className="space-y-1">
          <span className="text-sm">Inversión mensual en anuncios (MX$)</span>
          <input
            type="text"
            inputMode="numeric"
            className="w-full rounded-xl border p-2"
            value={adSpend}
            onChange={(e) => setAdSpend(digitsOnly(e.target.value))}
            onKeyDown={(e) => {
              if (!isAllowedKey(e)) e.preventDefault();
            }}
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

        {/* Repetición: número 0–10 o “No sé” */}
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
              onKeyDown={(e) => {
                if (!isAllowedKey(e)) e.preventDefault();
              }}
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
              {noPersonas
                ? "Carga al menos una persona para continuar."
                : "Completa los campos requeridos con valores mayores a 0."}
            </p>
          )}
        </div>
      </form>

      {error && <p className="text-sm text-red-600">Error: {error}</p>}

      {/* Resultado + Q&A */}
      {result && (
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 text-gray-800 space-y-5">
          <h2 className="text-xl font-semibold">Tu resultado</h2>
          <div className="space-y-1">
            <p className="text-base">
              <span className="font-semibold">Eficiencia general:</span> {result.efficiencyScore}/10
            </p>
          </div>
          {Array.isArray(result.narratives) && result.narratives.length > 0 && (
            <ul className="list-disc ml-5 text-sm text-gray-700 space-y-1">
              {result.narratives.map((line, i) => (
                <li key={`narr-${i}`}>{line}</li>
              ))}
            </ul>
          )}

          {/* Elección de enfoque */}
          <div className="pt-2 border-t">
            <p className="text-sm mb-2">¿Qué quieres hacer ahora?</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`px-3 py-1.5 rounded-xl text-sm border ${
                  focus === "efficiency" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-800"
                }`}
                onClick={() => setFocus("efficiency")}
              >
                Gastar menos en anuncios
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-xl text-sm border ${
                  focus === "conversion" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-800"
                }`}
                onClick={() => setFocus("conversion")}
              >
                Lograr más clientes de regreso
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-xl text-sm border ${
                  focus === "insight" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-800"
                }`}
                onClick={() => setFocus("insight")}
              >
                Conocer más de mis clientes
              </button>
            </div>
          </div>

          {/* Q&A: sugeridas + libre (select only; ask on click) */}
          {focus && (
            <div className="space-y-3">
              <p className="text-sm">Pregúntale a tu cliente ideal:</p>

              <div className="flex flex-col gap-2">
                {(focus === "insight"
                  ? starterQs.insight
                  : focus === "efficiency"
                  ? starterQs.efficiency
                  : starterQs.conversion
                ).map((s, idx) => (
                  <button
                    key={`sq-${idx}`}
                    type="button"
                    className="text-left text-sm px-3 py-2 rounded-xl border hover:bg-gray-50"
                    onClick={() => setQuestion(s)} // select only
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 items-start">
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={`¿Qué quieres saber de ${personaName}?`}
                  className="flex-1 rounded-xl border p-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => askPersona(question)} // ask explicitly
                  disabled={!question || qnaLoading}
                  className="rounded-xl bg-indigo-600 text-white px-4 py-2 text-sm disabled:opacity-60"
                >
                  {qnaLoading ? "Preguntando…" : "Preguntar"}
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Selecciona una sugerencia o escribe tu pregunta y presiona <span className="font-medium">Preguntar</span>.
              </p>

              {qnaError && <p className="text-sm text-red-600">Error: {qnaError}</p>}
              {personaAns && (
                <div className="rounded-2xl border p-4 space-y-3 bg-gray-50">
                  <p className="text-sm text-gray-600">Soy {personaName}:</p>
                  <p className="text-sm">
                    <span className="font-medium">Reacción:</span> “{personaAns.reaction}”
                  </p>
                  <div>
                    <p className="font-medium text-sm">Dudas del cliente</p>
                    <ul className="list-disc ml-5 text-sm text-gray-700">
                      {personaAns.dudasCliente.map((d, i) => (
                        <li key={`duda-${i}`}>{d}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Sugerencias</p>
                    <ul className="list-disc ml-5 text-sm text-gray-700">
                      {personaAns.sugerencias.map((s, i) => (
                        <li key={`sug-${i}`}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-sm">
                    <span className="font-medium">Probabilidad de conversión:</span>{" "}
                    {personaAns.conversionLikelihood}/10
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}