// src/components/IntakeForm.tsx
"use client";

import { useState } from "react";

type Scorecard = {
  efficiencyScore: number;
  conversionScore: number;
  objections: string[]; 
  suggestions: string[];
};

export default function IntakeForm() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Scorecard | null>(null);
  const [error, setError] = useState<string | null>(null);

  // v0 defaults (we’ll wire personaType + city from the page later)
  const [form, setForm] = useState({
    personaType: "nutriologa",
    city: "Monterrey",
    patientsPerMonth: "50",
    avgTicket: "600",
    mainChannel: "instagram",
    adSpend: "2000",
    returnRate: "3-4",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/scorecard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaType: form.personaType,
          city: form.city,
          patientsPerMonth: Number(form.patientsPerMonth),
          avgTicket: Number(form.avgTicket),
          mainChannel: form.mainChannel,
          adSpend: Number(form.adSpend),
          returnRate: form.returnRate,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setResult(json);
    } catch (err: any) {
      setError(err?.message ?? "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-2xl p-4 rounded-2xl border border-gray-200 shadow-sm space-y-4">
      <h2 className="text-lg font-semibold">Intake (5 preguntas)</h2>
      <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Patients per month */}
        <label className="space-y-1">
          <span className="text-sm">Pacientes/mes</span>
          <select
            className="w-full rounded-xl border p-2"
            value={form.patientsPerMonth}
            onChange={(e) => setForm({ ...form, patientsPerMonth: e.target.value })}
          >
            <option value="15">10–20</option>
            <option value="30">20–40</option>
            <option value="60">40–80</option>
            <option value="90">80+</option>
          </select>
        </label>

        {/* Avg ticket */}
        <label className="space-y-1">
          <span className="text-sm">Ticket promedio (MX$)</span>
          <select
            className="w-full rounded-xl border p-2"
            value={form.avgTicket}
            onChange={(e) => setForm({ ...form, avgTicket: e.target.value })}
          >
            <option value="300">&lt;400</option>
            <option value="600">400–700</option>
            <option value="1000">700–1500</option>
            <option value="1800">1500+</option>
          </select>
        </label>

        {/* Main channel */}
        <label className="space-y-1">
          <span className="text-sm">Canal principal</span>
          <select
            className="w-full rounded-xl border p-2"
            value={form.mainChannel}
            onChange={(e) => setForm({ ...form, mainChannel: e.target.value })}
          >
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="tiktok">TikTok</option>
            <option value="google">Google</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="referidos">Referidos</option>
            <option value="otros">Otros</option>
          </select>
        </label>


        {/* Ad spend */}
        <label className="space-y-1">
          <span className="text-sm">Inversión mensual en anuncios (MX$)</span>
          <select
            className="w-full rounded-xl border p-2"
            value={form.adSpend}
            onChange={(e) => setForm({ ...form, adSpend: e.target.value })}
          >
            <option value="300">0–500</option>
            <option value="1200">500–2000</option>
            <option value="3500">2000–5000</option>
            <option value="7000">5000+</option>
          </select>
        </label>

        {/* Return rate */}
        <label className="space-y-1">
          <span className="text-sm">De 10 nuevos, ¿cuántos regresan a 2ª cita?</span>
          <select
            className="w-full rounded-xl border p-2"
            value={form.returnRate}
            onChange={(e) => setForm({ ...form, returnRate: e.target.value })}
          >
            <option value="0-2">0–2</option>
            <option value="3-4">3–4</option>
            <option value="5-6">5–6</option>
            <option value="7-8">7–8</option>
            <option value="9-10">9–10</option>
          </select>
        </label>

        {/* Submit */}
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-indigo-600 text-white px-4 py-2 text-sm disabled:opacity-60"
          >
            {loading ? "Calculando..." : "Generar scorecard"}
          </button>
        </div>
      </form>

      {/* Results */}
      {error && <p className="text-sm text-red-600">Error: {error}</p>}
      {result && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-gray-100">
          <h2 className="text-xl font-semibold mb-3">Resultados del Scorecard</h2>

          <div className="space-y-4">
            <div>
              <p className="text-base">
                <span className="font-semibold">Eficiencia:</span> {result.efficiencyScore}/10
              </p>
              <p className="text-sm text-gray-300">
                Mide qué tan bien aprovechas tu inversión en anuncios. Un puntaje alto significa que tu
                costo por paciente nuevo está dentro del rango esperado (más barato = más eficiente).
              </p>
            </div>

            <div>
              <p className="text-base">
                <span className="font-semibold">Conversión:</span> {result.conversionScore}/9
              </p>
              <p className="text-sm text-gray-300">
                Mide la capacidad de tus pacientes para regresar después de la primera visita.
                Un puntaje alto indica buena retención y confianza en tu consulta.
              </p>
            </div>

            <div>
              <p className="font-medium">Objeciones</p>
              <ul className="list-disc ml-5 text-sm text-gray-200">
                {result.objections?.map((o, i) => <li key={`obj-${i}`}>{o}</li>)}
              </ul>
            </div>

            <div>
              <p className="font-medium">Sugerencias</p>
              <ul className="list-disc ml-5 text-sm text-gray-200">
                {result.suggestions?.map((s, i) => <li key={`sug-${i}`}>{s}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
