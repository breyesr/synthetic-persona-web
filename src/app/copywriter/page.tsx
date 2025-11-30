// src/app/copywriter/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import {
  Loader2,
  Megaphone,
  PenSquare,
  CheckSquare,
  Target,
  Send,
  Hash,
  AlignLeft,
} from "lucide-react";

const FIELD_LIMITS = {
  context: { min: 10, max: 600 },
  message: { min: 5, max: 800 },
  goal: { min: 5, max: 400 },
};

type PersonaOption = { id: string; name: string; role?: string };

type Platform = {
  id: string;
  name: string;
  platform_purpose?: string;
  core_voice?: string;
  tone_adaptation?: string;
  copy_guidelines_summary?: string;
  global_guidelines?: Record<string, any>;
  formats: Format[];
};

type Format = {
  id: string;
  platform_id: string;
  name: string;
  primary_goal_vibe?: string;
  tone_preference?: string;
  copy_guidelines?: Record<string, any>;
};

type CopyOutput = {
  platformId: string;
  platformName: string;
  formatId: string;
  formatName: string;
  primaryCopy: string;
  alternateCopy?: string;
  hashtags?: string[];
  cta?: string;
  notes?: string[];
};

type CopywriterResponse = {
  persona: string;
  context?: string;
  goal: string;
  message: string;
  outputs: CopyOutput[];
};

export default function CopywriterPage() {
  const [personas, setPersonas] = useState<PersonaOption[]>([]);
  const [personaType, setPersonaType] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [context, setContext] = useState("");
  const [message, setMessage] = useState("");
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CopywriterResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [personasRes, copywriterRes] = await Promise.all([
          fetch("/api/personas", { cache: "no-store" }),
          fetch("/api/copywriter", { cache: "no-store" }),
        ]);

        if (!personasRes.ok) throw new Error(`HTTP ${personasRes.status}`);
        if (!copywriterRes.ok) throw new Error(`HTTP ${copywriterRes.status}`);

        const personasData = await personasRes.json();
        const copywriterData = await copywriterRes.json();

        if (cancelled) return;

        const rawPersonas: PersonaOption[] = Array.isArray(personasData)
          ? personasData
          : Array.isArray(personasData?.options)
          ? personasData.options
          : [];
        const personaList = rawPersonas.map((p) => ({
          ...p,
          name:
            p.role?.trim() && p.role !== p.name
              ? `${p.name} — ${p.role}`
              : p.name,
        }));
        setPersonas(personaList);
        if (personaList.length > 0) setPersonaType(personaList[0].id);

        const platformsData: Platform[] = Array.isArray(copywriterData?.platforms)
          ? copywriterData.platforms
          : [];
        setPlatforms(platformsData);
        if (platformsData.length > 0) {
          setSelectedPlatforms([platformsData[0].id]);
          const firstFormats = platformsData[0].formats ?? [];
          if (firstFormats.length > 0) setSelectedFormats([firstFormats[0].id]);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load copywriter data.";
        setError(message);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const availableFormats = useMemo(() => {
    return platforms
      .filter((p) => selectedPlatforms.includes(p.id))
      .flatMap((p) => p.formats);
  }, [platforms, selectedPlatforms]);

  const groupedOutputs = useMemo(() => {
    if (!result) return [];
    const map = new Map<
      string,
      { platformId: string; platformName: string; items: CopyOutput[] }
    >();
    result.outputs.forEach((o) => {
      if (!map.has(o.platformId)) {
        map.set(o.platformId, {
          platformId: o.platformId,
          platformName: o.platformName,
          items: [],
        });
      }
      map.get(o.platformId)!.items.push(o);
    });
    return Array.from(map.values());
  }, [result]);

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) => {
      const exists = prev.includes(id);
      if (exists) {
        const next = prev.filter((p) => p !== id);
        setSelectedFormats((formats) =>
          formats.filter((f) => {
            const fmt = availableFormats.find((af) => af.id === f);
            return fmt ? next.includes(fmt.platform_id) : false;
          })
        );
        return next;
      }
      return [...prev, id];
    });
  };

  const toggleFormat = (id: string) => {
    setSelectedFormats((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const isFormValid =
    personaType &&
    context.trim().length >= FIELD_LIMITS.context.min &&
    context.trim().length <= FIELD_LIMITS.context.max &&
    message.trim().length >= FIELD_LIMITS.message.min &&
    message.trim().length <= FIELD_LIMITS.message.max &&
    goal.trim().length >= FIELD_LIMITS.goal.min &&
    goal.trim().length <= FIELD_LIMITS.goal.max &&
    selectedPlatforms.length > 0 &&
    selectedFormats.length > 0;

  const handleSubmit = async () => {
    if (!isFormValid || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/copywriter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaType,
          context: context.trim(),
          message: message.trim(),
          goal: goal.trim(),
          platforms: selectedPlatforms,
          formats: selectedFormats,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const msg = errBody?.error
          ? `${res.status} ${errBody.error}`
          : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      const data = (await res.json()) as CopywriterResponse;
      setResult(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate copy.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!result) return;
    const date = new Date().toISOString().slice(0, 10);
    const lines: string[] = [];
    lines.push(`COPYWRITER REPORT`);
    lines.push(`Generated: ${date}`);
    lines.push(`Persona: ${result.persona}`);
    if (result.context) lines.push(`Context: ${result.context}`);
    lines.push(`Goal: ${result.goal}`);
    lines.push(`Message: ${result.message}`);
    lines.push(``);
    result.outputs.forEach((o) => {
      lines.push(`--- ${o.platformName} / ${o.formatName} ---`);
      lines.push(`Primary: ${o.primaryCopy}`);
      if (o.alternateCopy) lines.push(`Alt: ${o.alternateCopy}`);
      if (o.cta) lines.push(`CTA: ${o.cta}`);
      if (o.hashtags?.length) lines.push(`Hashtags: ${o.hashtags.join(" ")}`);
      if (o.notes?.length) {
        lines.push(`Notes:`);
        o.notes.forEach((n) => lines.push(`- ${n}`));
      }
      lines.push(``);
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `copywriter-${date}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const platformColors: Record<string, string> = {
    instagram: "#E1306C",
    facebook: "#1877F2",
    linkedin: "#0A66C2",
    tiktok: "#0f0f0f",
    default: "#4F46E5",
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#ededed] px-4 py-12">
      <div className="max-w-5xl mx-auto">
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <Megaphone className="w-6 h-6 text-[#4F46E5]" />
            <h1 className="text-3xl font-semibold tracking-tight">
              Copywriter Studio
            </h1>
          </div>
          <p className="text-sm text-[#a1a1aa] max-w-3xl">
            Generate platform-native copy that respects tone, format, and company
            rules across Instagram, LinkedIn, Facebook, and TikTok.
          </p>
        </header>

        <div className="space-y-5">
          <div className="bg-[#0f0f10] border border-[rgba(255,255,255,0.08)] rounded-xl p-5 shadow-lg shadow-black/30">
            <div className="flex items-center gap-2 mb-4">
              <PenSquare className="w-4 h-4 text-[#4F46E5]" />
              <p className="text-sm font-semibold text-[#ededed]">Brief</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#a1a1aa] mb-2">
                  Persona
                </label>
                <select
                  value={personaType}
                  onChange={(e) => setPersonaType(e.target.value)}
                  className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent transition-all"
                >
                  {personas.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#171717]">
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#a1a1aa] mb-2">
                  Context
                </label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  rows={3}
                  placeholder="Summarize the situation, audience, timing, constraints, or campaign details."
                  className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent transition-all resize-none"
                />
                <span
                  className={clsx(
                    "block text-xs text-right mt-1",
                  context.length < FIELD_LIMITS.context.min ||
                    context.length > FIELD_LIMITS.context.max
                      ? "text-red-400"
                      : "text-gray-400"
                  )}
                >
                  {context.length}/{FIELD_LIMITS.context.max}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#a1a1aa] mb-2">
                  What we want to say
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Describe the key message, offer, or announcement."
                  className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent transition-all resize-none"
                />
                <span
                  className={clsx(
                    "block text-xs text-right mt-1",
                    message.length < FIELD_LIMITS.message.min ||
                      message.length > FIELD_LIMITS.message.max
                      ? "text-red-400"
                      : "text-gray-400"
                  )}
                >
                  {message.length}/{FIELD_LIMITS.message.max}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#a1a1aa] mb-2">
                  Goal / Objective
                </label>
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  rows={3}
                  placeholder="e.g., Drive webinar signups, spark comments, or push demos."
                  className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent transition-all resize-none"
                />
                <span
                  className={clsx(
                    "block text-xs text-right mt-1",
                    goal.length < FIELD_LIMITS.goal.min ||
                      goal.length > FIELD_LIMITS.goal.max
                      ? "text-red-400"
                      : "text-gray-400"
                  )}
                >
                  {goal.length}/{FIELD_LIMITS.goal.max}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[#0f0f10] border border-[rgba(255,255,255,0.08)] rounded-xl p-5 shadow-lg shadow-black/30">
            <div className="flex items-center gap-2 mb-4">
              <CheckSquare className="w-4 h-4 text-[#4F46E5]" />
              <p className="text-sm font-semibold text-[#ededed]">Platforms</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {platforms.map((platform) => (
                <label
                  key={platform.id}
                  className={clsx(
                    "flex flex-col gap-1 p-3 rounded-lg border transition-all cursor-pointer bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.06)]",
                    selectedPlatforms.includes(platform.id)
                      ? "border-[#4F46E5]/50 shadow-[0_0_0_1px_rgba(79,70,229,0.3)]"
                      : "border-[rgba(255,255,255,0.08)]"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedPlatforms.includes(platform.id)}
                        onChange={() => togglePlatform(platform.id)}
                        className="h-4 w-4 accent-[#4F46E5]"
                      />
                      <span className="text-sm font-medium">{platform.name}</span>
                    </div>
                    <span className="text-[10px] uppercase tracking-wide text-[#a1a1aa]">
                      {platform.formats.length} formats
                    </span>
                  </div>
                  <p className="text-xs text-[#a1a1aa] line-clamp-2">
                    {platform.copy_guidelines_summary ||
                      platform.platform_purpose ||
                      "Platform-native guidance"}
                  </p>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-[#0f0f10] border border-[rgba(255,255,255,0.08)] rounded-xl p-5 shadow-lg shadow-black/30">
            <div className="flex items-center gap-2 mb-4">
              <AlignLeft className="w-4 h-4 text-[#4F46E5]" />
              <p className="text-sm font-semibold text-[#ededed]">Formats</p>
              <span className="text-[11px] text-[#a1a1aa]">
                (Grouped by selected platform)
              </span>
            </div>
            {selectedPlatforms.length === 0 ? (
              <p className="text-xs text-[#a1a1aa]">Select a platform first.</p>
            ) : (
              <div className="space-y-4">
                {selectedPlatforms.map((pid) => {
                  const plat = platforms.find((p) => p.id === pid);
                  if (!plat) return null;
                  const color = platformColors[plat.id] || platformColors.default;
                  return (
                    <div
                      key={plat.id}
                      className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-3"
                      style={{ boxShadow: `0 0 0 1px ${color}26` }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold" style={{ color }}>
                          {plat.name}
                        </span>
                        <span className="text-[11px] text-[#a1a1aa] uppercase">
                          {plat.formats.length} options
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {plat.formats.map((format) => (
                          <label
                            key={format.id}
                            className={clsx(
                              "flex flex-col gap-1 p-3 rounded-lg border transition-all cursor-pointer",
                              selectedFormats.includes(format.id)
                                ? "bg-[rgba(255,255,255,0.06)]"
                                : "bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.05)]"
                            )}
                            style={{
                              borderColor: selectedFormats.includes(format.id)
                                ? `${color}66`
                                : "rgba(255,255,255,0.1)",
                              boxShadow: selectedFormats.includes(format.id)
                                ? `0 0 0 1px ${color}33`
                                : "none",
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedFormats.includes(format.id)}
                                  onChange={() => toggleFormat(format.id)}
                                  className="h-4 w-4 accent-[#4F46E5]"
                                />
                                <span className="text-sm font-medium">
                                  {format.name}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-[#a1a1aa] line-clamp-2">
                              {format.tone_preference ||
                                format.primary_goal_vibe ||
                                "Format-specific guidelines"}
                            </p>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-[#0f0f10] border border-[rgba(255,255,255,0.08)] rounded-xl p-4 shadow-lg shadow-black/30">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-[#4F46E5]" />
              <p className="text-sm font-semibold text-[#ededed]">Action</p>
            </div>
            <p className="text-xs text-[#a1a1aa] mb-3">
              Generate platform-native copy that obeys tone, format, and company
              rules.
            </p>
            <button
              onClick={handleSubmit}
              disabled={!isFormValid || loading}
              className={clsx(
                "w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all",
                "focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:ring-offset-2 focus:ring-offset-[#0a0a0a]",
                isFormValid && !loading
                  ? "bg-[#4F46E5] hover:bg-[#6366F1] text-white shadow-lg shadow-[#4F46E5]/20"
                  : "bg-[rgba(255,255,255,0.05)] text-[#a1a1aa] cursor-not-allowed"
              )}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating copy...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" />
                  Generate copy
                </span>
              )}
            </button>
            <div className="text-[11px] text-[#a1a1aa] mt-3">
              Validation: persona, message, goal, platform(s), and format(s) are
              required.
            </div>
            {error && (
              <div className="bg-red-500/10 border border-red-500/40 text-red-200 text-sm rounded-lg p-3 mt-4">
                {error}
              </div>
            )}
          </div>
        </div>

        {result && (
          <div className="mt-10 space-y-6">
            <div className="flex items-center gap-3 justify-between">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-[#4F46E5]" />
                <h2 className="text-lg font-semibold">Generated Copy</h2>
                <span className="text-sm text-[#a1a1aa]">
                  Persona: {result.persona}
                </span>
              </div>
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-[#ededed] bg-gradient-to-br from-[#171717] to-[#0f0f0f] border border-[rgba(255,255,255,0.15)] rounded-lg transition-all shadow-lg shadow-black/30 focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/40 hover:bg-[rgba(255,255,255,0.05)] hover:-translate-y-0.5 hover:border-[#4F46E5]/40 hover:shadow-[#4F46E5]/20 active:translate-y-[1px] active:scale-[0.99] active:border-[#4F46E5]/50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-gray-500"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download (.txt)
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {groupedOutputs.map((group) => (
                <div
                  key={group.platformId}
                  className="bg-gradient-to-br from-[#171717] to-[#0a0a0a] border border-[rgba(255,255,255,0.12)] rounded-xl p-5 shadow-xl"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-[#a1a1aa] uppercase tracking-wide">
                        {group.platformName}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {group.items.map((item) => (
                      <div
                        key={item.formatId}
                        className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)] p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">
                            {item.formatName}
                          </p>
                          <span className="text-[11px] text-[#a1a1aa] uppercase">
                            {item.formatId}
                          </span>
                        </div>
                        <div className="space-y-2 text-sm text-[#ededed]">
                          <div className="space-y-1">
                            <p className="text-[#a1a1aa] text-xs uppercase tracking-wide">
                              Primary Copy
                            </p>
                            <p className="leading-relaxed">{item.primaryCopy}</p>
                          </div>
                          {item.alternateCopy && (
                            <div className="space-y-1">
                              <p className="text-[#a1a1aa] text-xs uppercase tracking-wide">
                                Alt Copy
                              </p>
                              <p className="leading-relaxed">
                                {item.alternateCopy}
                              </p>
                            </div>
                          )}
                          {item.cta && (
                            <div className="space-y-1">
                              <p className="text-[#a1a1aa] text-xs uppercase tracking-wide">
                                CTA
                              </p>
                              <p>{item.cta}</p>
                            </div>
                          )}
                          {item.hashtags && item.hashtags.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-[#a1a1aa] text-xs uppercase tracking-wide">
                                Hashtags
                              </p>
                              <p className="text-[#ededed]">
                                {item.hashtags.join(" ")}
                              </p>
                            </div>
                          )}
                          {item.notes && item.notes.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-[#a1a1aa] text-xs uppercase tracking-wide">
                                Notes
                              </p>
                              <ul className="list-disc list-inside text-[#ededed]/90">
                                {item.notes.map((n, idx) => (
                                  <li key={idx}>{n}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-10 pt-6 border-t border-gray-100 flex justify-end pb-12">
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-[#ededed] bg-gradient-to-br from-[#171717] to-[#0f0f0f] border border-[rgba(255,255,255,0.15)] rounded-lg transition-all shadow-lg shadow-black/30 focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/40 hover:bg-[rgba(255,255,255,0.05)] hover:-translate-y-0.5 hover:border-[#4F46E5]/40 hover:shadow-[#4F46E5]/20 active:translate-y-[1px] active:scale-[0.99] active:border-[#4F46E5]/50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-gray-500"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download (.txt)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
