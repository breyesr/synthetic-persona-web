// src/app/page.tsx
"use client";

import { useEffect, useState } from "react";
import { User, BarChart, AlertTriangle, CheckCircle, Sparkles, Loader2, MessageSquare, TrendingUp, Shield, Award, Target, HelpCircle, XCircle, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';

// Types
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

type PersonaOption = {
    id: string;
    name:string;
};

const FIELD_LIMITS = {
    idea: { min: 10, max: 1500 },
    goal: { min: 5, max: 300 },
    evaluationFocus: { min: 5, max: 300 },
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

        const loadInitialData = async () => {
            try {
                const [personasRes, levelsRes] = await Promise.all([
                    fetch("/api/personas", { cache: "no-store" }),
                    fetch("/api/challenge-levels", { cache: "no-store" })
                ]);

                if (!personasRes.ok) throw new Error(`HTTP ${personasRes.status} for personas`);
                if (!levelsRes.ok) throw new Error(`HTTP ${levelsRes.status} for levels`);

                const personasData = await personasRes.json();
                const levelsData = await levelsRes.json();

                if (!cancelled) {
                    const personaList: Array<{ id: string; name: string; role?: string }> = Array.isArray(personasData)
                        ? personasData
                        : Array.isArray(personasData?.options)
                            ? personasData.options
                            : [];

                    const lookup: Record<string, string> = {};
                    const selectOptions: PersonaOption[] = personaList.map((item) => {
                        lookup[item.id] = item.name;
                        return {
                            id: item.id,
                            name: item.role?.trim() ? `${item.name} — ${item.role}` : item.name,
                        };
                    });
                    setPersonas(selectOptions);
                    setPersonaNames(lookup);
                    if (selectOptions.length > 0) {
                        setPersonaType(selectOptions[0].id);
                    }


                    const levelList: ChallengeLevelOption[] = Array.isArray(levelsData)
                        ? levelsData
                        : Array.isArray(levelsData?.options)
                            ? levelsData.options
                            : [];
                    setLevels(levelList);
                    if (levelList.length > 1) {
                        setChallengeLevelId(levelList[1].id);
                    } else if (levelList.length > 0) {
                        setChallengeLevelId(levelList[0].id);
                    }
                }
            } catch (err) {
                if (!cancelled) {
                    const message =
                        err instanceof Error ? err.message : "Unable to load initial data.";
                    setError(message);
                }
            }
        };

        loadInitialData();

        return () => {
            cancelled = true;
        };
    }, []);

    const isFormValid = idea.trim().length >= FIELD_LIMITS.idea.min &&
                        idea.trim().length <= FIELD_LIMITS.idea.max &&
                        goal.trim().length >= FIELD_LIMITS.goal.min &&
                        goal.trim().length <= FIELD_LIMITS.goal.max &&
                        evaluationFocus.trim().length >= FIELD_LIMITS.evaluationFocus.min &&
                        evaluationFocus.trim().length <= FIELD_LIMITS.evaluationFocus.max &&
                        personaType &&
                        challengeLevelId;

    const handleSubmit = async () => {
        if (!isFormValid || loading) return;

        setLoading(true);
        setResult(null);
        setError(null);

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
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const json = await res.json();
            setResult(json as StressResult);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Could not get a response.";
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const getConfidenceBadgeColor = (score: number) => {
        if (score >= 70) return 'bg-green-500/20 text-green-400 border-green-500/30';
        if (score >= 40) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
        return 'bg-red-500/20 text-red-400 border-red-500/30';
    };
    
    const selectedPersonaName = personas.find(p => p.id === personaType)?.name.split('—')[0].trim() || 'Persona';

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-[#ededed] px-4 py-12">
            <div className="max-w-4xl mx-auto">
                <header className="mb-12">
                    <h1 className="text-4xl font-semibold tracking-tight mb-3">
                        Idea Stress Testing Tool v.1.1
                    </h1>
                    <p className="text-sm text-[#a1a1aa] max-w-3xl">
                        I'm built to be an informed, well-trained, and value-additive dissenting expert.
                        Use me to avoid falling into the confirmation bias trap.
                    </p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[#a1a1aa] mb-2">
                            Persona
                        </label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a1a1aa]" />
                            <select
                                value={personaType}
                                onChange={(e) => setPersonaType(e.target.value)}
                                aria-label="Select persona"
                                className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent transition-all"
                            >
                                {personas.map((p) => (
                                    <option key={p.id} value={p.id} className="bg-[#171717]">
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[#a1a1aa] mb-2">
                            Challenge Level
                        </label>
                        <div className="relative">
                            <BarChart className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a1a1aa]" />
                            <select
                                value={challengeLevelId}
                                onChange={(e) => setChallengeLevelId(e.target.value)}
                                aria-label="Select challenge level"
                                className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent transition-all"
                            >
                                {levels.map((l) => (
                                    <option key={l.id} value={l.id} className="bg-[#171717]">
                                        {l.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="space-y-4 mb-6">
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[#a1a1aa]">
                                Idea
                            </label>
                        </div>
                        <textarea
                            value={idea}
                            onChange={(e) => setIdea(e.target.value)}
                            placeholder="Describe the asset, pitch, or concept you want to stress-test..."
                            aria-label="Idea description"
                            rows={6}
                            className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent transition-all resize-none"
                        />
                        <span className={clsx(
                            "block text-xs text-right mt-1",
                            idea.length < FIELD_LIMITS.idea.min || idea.length > FIELD_LIMITS.idea.max ? "text-red-400" : "text-gray-400"
                        )}>
                            {idea.length}/{FIELD_LIMITS.idea.max}
                        </span>
                    </div>
                    

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[#a1a1aa]">
                                Goal
                            </label>
                        </div>
                        <textarea
                            value={goal}
                            onChange={(e) => setGoal(e.target.value)}
                            placeholder="What are you trying to achieve with this idea?"
                            aria-label="Goal description"
                            rows={3}
                            className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent transition-all resize-none"
                        />
                        <span className={clsx(
                            "block text-xs text-right mt-1",
                            goal.length < FIELD_LIMITS.goal.min || goal.length > FIELD_LIMITS.goal.max ? "text-red-400" : "text-gray-400"
                        )}>
                            {goal.length}/{FIELD_LIMITS.goal.max}
                        </span>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[#a1a1aa]">
                                Focus
                            </label>
                        </div>
                        <div className="relative">
                            <textarea
                                value={evaluationFocus}
                                onChange={(e) => setEvaluationFocus(e.target.value)}
                                placeholder="Example: Stress-test how clearly we communicate ROI to the CFO."
                                aria-label="Focus area"
                                rows={2}
                                className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent transition-all resize-none"
                            />
                            <span className={clsx(
                                "block text-xs text-right mt-1",
                                evaluationFocus.length < FIELD_LIMITS.evaluationFocus.min || evaluationFocus.length > FIELD_LIMITS.evaluationFocus.max ? "text-red-400" : "text-gray-400"
                            )}>
                                {evaluationFocus.length}/{FIELD_LIMITS.evaluationFocus.max}
                            </span>
                            <button
                                type="button"
                                aria-label="Auto-detect risks"
                                className="absolute right-3 top-3 p-1.5 rounded-md bg-[#4F46E5]/10 hover:bg-[#4F46E5]/20 transition-colors group"
                                title="Auto-detect Risks"
                            >
                                <Sparkles className="w-4 h-4 text-[#4F46E5] group-hover:text-[#6366F1]" />
                            </button>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={!isFormValid || loading}
                    className={clsx(
                        "w-full py-4 px-6 rounded-lg font-semibold text-sm transition-all",
                        "focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:ring-offset-2 focus:ring-offset-[#0a0a0a]",
                        isFormValid && !loading
                            ? "bg-[#4F46E5] hover:bg-[#6366F1] text-white shadow-lg shadow-[#4F46E5]/20"
                            : "bg-[rgba(255,255,255,0.05)] text-[#a1a1aa] cursor-not-allowed"
                    )}
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Running Simulation...
                        </span>
                    ) : (
                        `Stress-test with ${selectedPersonaName}`
                    )}
                </button>
                
                {error && <div className="mt-4 text-red-400 text-sm text-center">{error}</div>}

                {result && (
                    <div className="mt-8 space-y-6">
                        <div className="animate-scale-in bg-gradient-to-br from-[#171717] to-[#0a0a0a] border border-[rgba(255,255,255,0.15)] rounded-xl p-6 shadow-xl">
                            <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                    <h2 className="text-2xl font-semibold tracking-tight">{personaNames[personaType] || 'Persona'}</h2>
                                    <p className="text-sm text-[#a1a1aa]">Stress Test Analysis</p>
                                </div>
                                <div className={clsx(
                                    "px-4 py-2 rounded-full text-sm font-bold border-2 shadow-lg",
                                    getConfidenceBadgeColor(result.confidence)
                                )}>
                                    {result.confidence}% Confidence
                                </div>
                            </div>
                        </div>

                        <div className="animate-slide-in-up stagger-1 bg-gradient-to-r from-[#4F46E5]/10 via-[#4F46E5]/5 to-transparent border-l-4 border-[#4F46E5] rounded-r-xl overflow-hidden shadow-lg">
                            <div className="p-6">
                                <div className="flex items-center gap-3 pb-4 border-b border-[#4F46E5]/20 mb-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#4F46E5]/30 to-[#4F46E5]/10 flex items-center justify-center shadow-md">
                                        <MessageSquare className="w-6 h-6 text-[#4F46E5]" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-[#4F46E5]">
                                            Executive Verdict
                                        </h3>
                                        <p className="text-xs text-[#a1a1aa] mt-0.5">Professional Assessment</p>
                                    </div>
                                </div>
                                <p className="text-base leading-relaxed text-[#ededed]">{result.summary}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="animate-slide-in-up stagger-2 bg-gradient-to-br from-green-500/10 to-green-500/5 border-2 border-green-500/30 rounded-xl overflow-hidden shadow-lg">
                                <div className="p-6">
                                    <div className="flex items-center gap-3 pb-4 border-b border-green-500/20 mb-5">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/30 to-green-500/10 flex items-center justify-center shadow-md">
                                            <TrendingUp className="w-6 h-6 text-green-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold uppercase tracking-wider text-green-400">
                                                Strengths
                                            </h3>
                                            <p className="text-xs text-green-400/60 mt-0.5">{result.strengths.length} identified</p>
                                        </div>
                                    </div>
                                    <ul className="space-y-3">
                                        {result.strengths.map((strength, idx) => {
                                            const icons = [Shield, Award, TrendingUp];
                                            const Icon = icons[idx % icons.length];
                                            return (
                                                <li key={idx} className="flex items-start gap-3 text-sm bg-green-500/5 p-3.5 rounded-lg border border-green-500/10 hover:bg-green-500/10 transition-all hover:border-green-500/20">
                                                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                                                        <Icon className="w-4 h-4 text-green-400" />
                                                    </div>
                                                    <span className="text-[#ededed] pt-1">{strength}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            </div>

                            <div className="animate-slide-in-up stagger-3 bg-gradient-to-br from-red-500/10 to-red-500/5 border-2 border-red-500/30 rounded-xl overflow-hidden shadow-lg">
                                <div className="p-6">
                                    <div className="flex items-center gap-3 pb-4 border-b border-red-500/20 mb-5">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/30 to-red-500/10 flex items-center justify-center shadow-md">
                                            <AlertTriangle className="w-6 h-6 text-red-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold uppercase tracking-wider text-red-400">
                                                Gaps & Risks
                                            </h3>
                                            <p className="text-xs text-red-400/60 mt-0.5">{result.gaps.length} critical areas</p>
                                        </div>
                                    </div>
                                    <ul className="space-y-3">
                                        {result.gaps.map((gap, idx) => {
                                            const icons = [AlertCircle, XCircle, AlertTriangle];
                                            const Icon = icons[idx % icons.length];
                                            return (
                                                <li key={idx} className="flex items-start gap-3 text-sm bg-red-500/5 p-3.5 rounded-lg border border-red-500/10 hover:bg-red-500/10 transition-all hover:border-red-500/20">
                                                    <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                                                        <Icon className="w-4 h-4 text-red-400" />
                                                    </div>
                                                    <span className="text-[#ededed] pt-1">{gap}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className="animate-slide-in-up stagger-4 bg-gradient-to-br from-[#171717] to-[#0a0a0a] border border-[rgba(255,255,255,0.15)] rounded-xl overflow-hidden shadow-lg">
                            <div className="p-6">
                                <div className="flex items-center gap-3 pb-4 border-b border-[rgba(255,255,255,0.1)] mb-5">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#4F46E5]/30 to-[#4F46E5]/10 flex items-center justify-center shadow-md">
                                        <Target className="w-6 h-6 text-[#4F46E5]" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-[#4F46E5]">
                                            Priority Action Plan
                                        </h3>
                                        <p className="text-xs text-[#a1a1aa] mt-0.5">Recommended next steps</p>
                                    </div>
                                </div>
                                <ul className="space-y-3">
                                    {result.improvements.map((action, idx) => (
                                        <li key={idx} className="flex items-start gap-4 p-4 bg-[rgba(255,255,255,0.03)] rounded-lg border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.06)] transition-all hover:border-[#4F46E5]/30 hover:shadow-md group">
                                            <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-[#4F46E5] to-[#6366F1] text-white flex items-center justify-center text-sm font-bold shadow-md group-hover:shadow-lg transition-shadow">
                                                {idx + 1}
                                            </span>
                                            <span className="text-sm text-[#ededed] pt-1.5 leading-relaxed">{action}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <div className="animate-fade-in bg-gradient-to-br from-[#171717] to-[#0a0a0a] border border-[rgba(255,255,255,0.15)] rounded-xl overflow-hidden shadow-lg">
                            <div className="p-6">
                                <div className="flex items-center gap-3 pb-4 border-b border-[rgba(255,255,255,0.1)] mb-5">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/30 to-yellow-500/10 flex items-center justify-center shadow-md">
                                        <HelpCircle className="w-6 h-6 text-yellow-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-yellow-400">
                                            Follow-up Questions
                                        </h3>
                                        <p className="text-xs text-[#a1a1aa] mt-0.5">Critical clarifications needed</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-3">
                                    {result.questions.map((question, idx) => (
                                        <button
                                            key={idx}
                                            className="group px-4 py-3.5 bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] hover:border-[#4F46E5]/40 rounded-lg text-sm transition-all text-left shadow-sm hover:shadow-md hover:translate-x-1"
                                        >
                                            <span className="text-[#4F46E5] mr-2 group-hover:mr-3 transition-all">→</span>
                                            <span className="text-[#ededed]">{question}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}