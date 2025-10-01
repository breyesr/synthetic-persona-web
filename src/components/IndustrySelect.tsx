"use client";

import { useEffect, useMemo, useState } from "react";

export type IndustryOption = { id: string; name: string };

type Props = {
  value?: string;
  onChange: (id: string) => void;
  labelText?: string;
};

export default function IndustrySelect({ value, onChange, labelText = "¿Qué tipo de negocio tienes?" }: Props) {
  const [loading, setLoading] = useState(false);
  const [opts, setOpts] = useState<IndustryOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/industries", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: IndustryOption[] = await res.json();

        // sanitize: drop empties/dupes, normalize id
        const seen = new Set<string>();
        const clean = data
          .map(d => ({ id: (d?.id ?? "").trim().toLowerCase(), name: (d?.name ?? "").trim() }))
          .filter(d => d.id)
          .filter(d => {
            if (seen.has(d.id)) return false;
            seen.add(d.id);
            return true;
          });

        if (mounted) setOpts(clean);
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "No se pudieron cargar los tipos de negocio");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // keep selected in sync with options (prefer first option if current is invalid/empty)
  useEffect(() => {
    const first = opts[0]?.id ?? "";
    if (!value && first) onChange(first);
    if (value && !opts.find(o => o.id === value) && first) onChange(first);
  }, [opts, value, onChange]);

  const list = useMemo(() => opts, [opts]);

  return (
    <label className="space-y-1">
      <span className="text-sm">{labelText}</span>
      <select
        className="w-full rounded-xl border p-2 text-sm"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading || !!error || list.length === 0}
      >
        {loading && <option>Cargando…</option>}
        {error && <option>Error al cargar</option>}
        {!loading && !error && list.length === 0 && <option>Sin opciones</option>}
        {!loading && !error &&
          list.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name || opt.id}
            </option>
          ))}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </label>
  );
}