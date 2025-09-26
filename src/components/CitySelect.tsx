"use client";

import { useEffect, useMemo, useState } from "react";

export type CityOption = { id: string; name: string };

type Props = {
  value: string;
  onChange: (v: string) => void;
  labelText?: string;
  placeholderText?: string;
};

export default function CitySelect({
  value,
  onChange,
  labelText = "Ciudad",
  placeholderText = "(cargando ciudades…)",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [opts, setOpts] = useState<CityOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/cities", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as CityOption[];
        if (!mounted) return;
        // sanitize & dedupe
        const seen = new Set<string>();
        const cleaned = json
          .map((c) => ({ id: (c.id ?? "").trim(), name: (c.name ?? "").trim() || (c.id ?? "").trim() }))
          .filter((c) => c.id.length > 0 && !seen.has(c.id) && seen.add(c.id));
        setOpts(cleaned);
        // auto-select first if current value is empty or invalid
        if (!cleaned.find((c) => c.id === value)) {
          onChange(cleaned[0]?.id ?? "");
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? "No se pudieron cargar las ciudades");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []); // load once

  const options = useMemo(() => opts, [opts]);

  return (
    <label className="space-y-1">
      <span className="text-sm">{labelText}</span>
      <select
        className="w-full rounded-xl border p-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="City select"
        disabled={loading || !!error || options.length === 0}
      >
        {loading && <option value="">{placeholderText}</option>}
        {!loading && options.length > 0 && options.map((c) => (
          <option key={`city-${c.id}`} value={c.id}>{c.name}</option>
        ))}
        {!loading && options.length === 0 && <option value="">(sin opciones)</option>}
      </select>
      {error && <p className="text-xs text-red-600">Error: {error}</p>}
    </label>
  );
}