"use client";

import { useState, useEffect, useMemo } from "react";

export type PersonaOption = { id: string; name: string };

export default function PersonaSelect({ options }: { options: PersonaOption[] }) {
  // Sanitize: dedupe by id, drop empty ids, keep first occurrence
  const cleaned = useMemo(() => {
    const seen = new Set<string>();
    const out: PersonaOption[] = [];
    for (const opt of options ?? []) {
      const id = (opt?.id ?? "").trim();
      const name = (opt?.name ?? "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, name: name || id });
    }
    if ((options?.length ?? 0) !== out.length) {
      // Surface a friendly warning in dev
      console.warn(
        "[PersonaSelect] Dropped empty/duplicate persona IDs.",
        { before: options?.length ?? 0, after: out.length }
      );
    }
    return out;
  }, [options]);

  const [selected, setSelected] = useState<string>(cleaned[0]?.id ?? "");

  // Keep selected in sync if options update
  useEffect(() => {
    if (!cleaned.find(o => o.id === selected)) {
      setSelected(cleaned[0]?.id ?? "");
    }
  }, [cleaned, selected]);

  useEffect(() => {
    if (selected) {
      console.log("[PersonaSelect] selected:", selected);
    }
  }, [selected]);

  return (
    <div className="w-full max-w-md space-y-2 p-4 rounded-2xl shadow-sm border border-gray-200">
      <label className="block text-sm font-medium text-gray-700">
        Elige una persona
      </label>
      <select
        className="w-full rounded-xl border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        aria-label="Persona select"
      >
        {cleaned.length ? (
          cleaned.map((opt, idx) => (
            <option
              key={`persona-${opt.id}-${idx}`} // stable + fallback uniqueness
              value={opt.id}
            >
              {opt.name}
            </option>
          ))
        ) : (
          <option value="">(sin opciones)</option>
        )}
      </select>
      <p className="text-xs text-gray-500">
        Cambia la opción y revisa la consola del navegador para ver el ID seleccionado.
      </p>
    </div>
  );
}
