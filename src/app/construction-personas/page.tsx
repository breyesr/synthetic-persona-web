// src/app/construction-personas/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import PersonaSelect, { PersonaOption } from "@/components/PersonaSelect";

type StressResult = {
  persona?: string;
  challengeLevel: number;
  challengeLevelId?: string;
  challengeDetail?: string;
  challengeLabel: string;
  focus: string;
  summary: string;
  strengths: string[];
  gaps: string[];
  improvements: string[];
  questions: string[];
  confidence: number;
  tone?: string;
};

type ChallengeLevelOption = {
  id: string;
  name: string;
  detail: string;
  intensity: number;
};

export default function ConstructionPersonasPage() {
  const [personas, setPersonas] = useState<PersonaOption[]>([]);
  const [personaNames, setPersonaNames] = useState<Record<string, string>>({});
  const [personaType, setPersonaType] = useState<string>("");
  const [levels, setLevels] = useState<ChallengeLevelOption[]>([]);
  const [challengeLevelId, setChallengeLevelId] = useState<string>("");
  const [idea, setIdea] = useState("");
  const [goal, setGoal] = useState("");
  const [evaluationFocus, setEvaluationFocus] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StressResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPersonas = async () => {
      try {
        const res = await fetch("/api/personas/construction", { cache: "no-store" });
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
            err instanceof Error ? err.message : "Unable to load personas.";
          setError(message);
        }
      }
    };

    loadPersonas();
    (async () => {
      try {
        const res = await fetch("/api/challenge-levels", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list: ChallengeLevelOption[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.options)
            ? data.options
            : [];
        if (!cancelled) {
          setLevels(list);
          setChallengeLevelId((prev) => prev || list[0]?.id || "");
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Unable to load challenge levels.";
          setError(message);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const IDEA_MIN = 10;
  const GOAL_MIN = 5;
  const FOCUS_MIN = 5;

  const ideaInvalid = idea.trim().length < IDEA_MIN;
  const goalInvalid = goal.trim().length < GOAL_MIN;
  const focusInvalid = evaluationFocus.trim().length < FOCUS_MIN;
  const levelInvalid = !challengeLevelId;

  const disabled =
    !personaType || ideaInvalid || goalInvalid || focusInvalid || levelInvalid || loading;

  const personaName =
    result?.persona ??
    personaNames[personaType] ??
    personas.find((p) => p.id === personaType)?.name ??
    "this persona";

  const focusHint = useMemo(
    () =>
      evaluationFocus.trim()
        ? evaluationFocus.trim()
        : "Describe the angle you want to test (e.g., messaging clarity, executive pitch, client proof).",
    [evaluationFocus]
  );

  const selectedLevel = levels.find((lvl) => lvl.id === challengeLevelId);

  async function onAsk() {
    if (disabled) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/stress-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaType,
          challengeLevelId,
          idea: idea.trim(),
          goal: goal.trim(),
          evaluationFocus: evaluationFocus.trim(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setResult(json as StressResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not get a response.";
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
            Idea Stress Testing Tool
          </h1>
          <p className="text-sm text-gray-300">
            I&apos;m built to be an informed, well trained, and value-additive dissenting expert. Use me to avoid falling into the confirmation bias trap.
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
              <label className="text-xs uppercase tracking-wide text-gray-300">Challenge level</label>
              <div className="rounded-xl bg-white text-gray-500">
                <select
                  className="w-full rounded-xl border border-transparent bg-transparent p-3 text-sm text-gray-700 focus:outline-none"
                  value={challengeLevelId}
                  onChange={(e) => setChallengeLevelId(e.target.value)}
                >
                  {levels.map((lvl) => (
                    <option key={lvl.id} value={lvl.id}>
                      {lvl.name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-400">
                {selectedLevel?.detail ?? "Choose how intense you want the feedback."}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="space-y-1 block">
              <span className="text-sm text-gray-200 block">Idea</span>
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                rows={6}
                className="w-full rounded-2xl border border-white/10 bg-white/90 p-4 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Describe the asset, pitch, or concept you want to stress-test."
              />
            </label>
            <label className="space-y-1 block">
              <span className="text-sm text-gray-200 block">Goal</span>
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-white/10 bg-white/90 p-4 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="What are you trying to achieve with this idea?"
              />
            </label>
          </div>

          <label className="space-y-1 block">
            <span className="text-xs uppercase tracking-wide text-gray-300">Focus on “which angle to test”</span>
            <textarea
              value={evaluationFocus}
              onChange={(e) => setEvaluationFocus(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-white/20 bg-white/90 p-3 text-sm text-gray-700 shadow-inner"
              placeholder="Example: Stress-test how clearly we communicate ROI to the CFO."
            />
            <p className={`text-xs ${focusInvalid ? "text-red-500" : "text-gray-400"}`}>
              {focusInvalid
                ? "Enter at least 5 characters so we know what angle to test."
                : focusHint}
            </p>
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={onAsk}
              disabled={disabled}
              className="rounded-xl px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {loading ? "Evaluating…" : `Stress-test with ${personaName}`}
            </button>
            {error && <span className="text-sm text-rose-300">Error: {error}</span>}
          </div>
        </section>

        {result && (
          <section className="rounded-2xl border border-white/10 bg-white p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {personaName} — {result.focus}
                </h2>
                <p className="text-sm text-gray-500">
                  {result.challengeLabel}
                  {result.challengeDetail ? ` — ${result.challengeDetail}` : ""}
                </p>
              </div>
              <div className="text-xs text-gray-600">
                Confidence: <span className="font-semibold">{result.confidence}%</span>
              </div>
            </div>

            <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-800 space-y-2">
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Summary {result.tone ? `• Tone: ${result.tone}` : ""}
              </p>
              <p>{result.summary}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="font-medium text-sm text-gray-900">Strengths</p>
                <ul className="list-disc ml-5 text-sm text-gray-700 space-y-1">
                  {result.strengths.map((item, idx) => (
                    <li key={`strength-${idx}`}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-sm text-gray-900">Gaps / risks</p>
                <ul className="list-disc ml-5 text-sm text-gray-700 space-y-1">
                  {result.gaps.map((item, idx) => (
                    <li key={`gap-${idx}`}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <p className="font-medium text-sm text-gray-900 mb-1">Priority fixes</p>
              <ul className="list-disc ml-5 text-sm text-gray-700 space-y-1">
                {result.improvements.map((item, idx) => (
                  <li key={`improvement-${idx}`}>{item}</li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-medium text-sm text-gray-900 mb-1">Follow-up questions</p>
              <ul className="list-disc ml-5 text-sm text-gray-700 space-y-1">
                {result.questions.map((item, idx) => (
                  <li key={`question-${idx}`}>{item}</li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
