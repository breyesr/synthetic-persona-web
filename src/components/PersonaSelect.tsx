"use client";

import { useMemo } from "react";

export type PersonaOption = { id: string; name: string };

type Props = {
  options?: PersonaOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  labelText?: string; // NEW: customizable label
};

export default function PersonaSelect({ options, value, onChange, className, labelText }: Props) {
  const cleaned = useMemo(() => {
    const src = options ?? [];
    const seen = new Set<string>();
    const out: PersonaOption[] = [];
    for (const opt of src) {
      const id = (opt?.id ?? "").trim();
      const name = (opt?.name ?? "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, name: name || id });
    }
    return out;
  }, [options]);

  const hasOptions = cleaned.length > 0;

  return (
    <label className={`space-y-1 ${className ?? ""}`}>
      <span className="text-sm">{labelText ?? "Elige una persona"}</span>
      <select
        className="w-full rounded-xl border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        value={hasOptions ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Persona select"
        disabled={!hasOptions}
      >
        {hasOptions ? (
          cleaned.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name}
            </option>
          ))
        ) : (
          <option value="">(sin opciones)</option>
        )}
      </select>
      {!hasOptions && (
        <p className="text-xs text-gray-500">Carga una persona para continuar.</p>
      )}
    </label>
  );
}