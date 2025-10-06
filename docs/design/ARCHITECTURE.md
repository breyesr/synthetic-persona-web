Architecture — Synthetic Persona Web

This document explains how the app works end-to-end: components, data flow, contracts, prompts, and where to extend.

⸻

1) High-Level Overview

┌──────────────┐        POST /api/scorecard         ┌────────────────────┐
│  IntakeForm  │ ─────────────────────────────────▶ │ Scorecard API      │
│  (Next.js)   │                                    │ (route.ts)         │
└─────┬────────┘                                    └─────────┬──────────┘
      │                                                       │
      │                                                       │
      │        POST /api/persona (question-aware)             │
      └──────────────────────────────────────────────────────▶│
                                                              │ builds insights (math + persona signals)
                                                              ▼
                                                     ┌────────────────────┐
                                                     │ Persona API        │
                                                     │ (route.ts)         │
                                                     └─────────┬──────────┘
                                                               │
                                                               ▼
                                                     ┌────────────────────┐
                                                     │ OpenAI (chat)      │
                                                     └────────────────────┘

  • Scorecard: numerical analysis + narrative (LLM with fallback).
  • Persona Q&A: answers the exact user question in first person (WhatsApp tone).
  • Insights: merges user numbers + persona signals → steps, impact, KPIs, and “how to talk to them”.

⸻

2) Runtime & Tech
  • Framework: Next.js 15 (App Router, app/), TypeScript.
  • UI: React + Tailwind classes.
  • APIs: Route handlers in src/app/api/**/route.ts.
  • LLM: OpenAI chat.completions (model: gpt-4o-mini), JSON mode for strict shapes.
  • Hosting: Vercel (main = prod, develop = staging).

⸻

3) Key Modules

3.1 src/components/IntakeForm.tsx
  • Collects inputs (persona, industry, city, clients/month, ticket, ad spend, channels, repetition).
  • Calls:
  • POST /api/scorecard to render Scorecard.
  • POST /api/persona to render Q&A + Insights.
  • Renders starter questions based on the selected focus:
  • medios, conversión, conocer.
  • Displays persona’s direct answer to the asked question (answerToQuestion).

3.2 src/app/api/scorecard/route.ts
  • Normalizes channels and looks up benchmarks (industry -> CPL, retention, ROAS target).
  • Computes:
  • approxLeads = round(clients * 1.2)
  • approxCPL = adSpend / approxLeads
  • spendTargetMain = approxLeads * medianCPL
  • flags underInvestingMain/overInvestingMain
  • simple ROAS proxy = (clients * avgTicket) / adSpend
  • efficiencyScore (blend of CPL, ROAS proxy, spend ratio)
  • Calls buildAIDiagnostic() (from lib/aiNarrative.ts) to generate a layman narrative (LLM with a deterministic fallback).

3.3 src/app/api/persona/route.ts
  • Validates body (zod).
  • Builds a system prompt that forces:
  • First-person, WhatsApp tone.
  • Client voice (no marketing/consultant voice).
  • Answer the exact question first (answerToQuestion), then list doubts/suggestions.
  • Performs a drift guard retry if the answer leaks to the wrong domain.
  • If numeric inputs are present, builds insights using buildActionableInsights() (question-aware with extra steps/KPIs).

3.4 src/lib/aiNarrative.ts
  • Types: NarrativeInputs (single source of truth for math fields used by LLM).
  • buildAIDiagnostic(inputs)
  • System prompt: layman, Spanish, max 6 bullets, no jargon.
  • If LLM fails, fall back to buildNarrativeStub(inputs) (deterministic but friendly).
  • buildActionableInsights({ personaName, inputs, personaBullets })
  • Synthesizes whatClientWantsSummary (one sentence, no raw repetition).
  • Produces whatToDoThisWeek, expectedImpact, howToKnow, howToTalk.
  • Adds question-aware extra steps & KPIs (e.g., if question mentions “clic/anuncio”, inject ad-specific actions).

  3.5 src/app/consultas/page.tsx
  • Purpose: open-ended conversation page for persona testing (“Consultas”).
  • UI:
    - Persona selector (uses /api/personas for dynamic list).
    - Industry selector (same component as IntakeForm).
    - Freeform question box with contextual placeholder (“Soy {Persona}. Pregúntame algo…”).
    - Button: “Preguntarle a {Persona}”.
  • Behavior:
    - Calls POST /api/persona with { personaType, businessType, question, focus: "insight" }.
    - Displays persona response in structured format:
        • answerToQuestion (main message, WhatsApp tone)
        • dudasCliente (bullets)
        • sugerencias (bullets)
        • conversionLikelihood (0–10 bar)
    - Does not require numeric inputs (patientsPerMonth, adSpend, etc.).
  • Use case:
    - Ideal for brainstorming ideas, testing new offers, and getting first-person qualitative feedback from personas.

⸻

4) Data Contracts

4.1 /api/scorecard — Request

{
  personaType: string;
  businessType: string;
  city: string;
  patientsPerMonth: number;
  avgTicket: number;
  mainChannel: string;
  adSpend: number;
  returnRate: string;             // "0-2"|"3-4"|"5-6"|"7-8"|"9-10"|"No sé"
  supportChannels?: string[];
}

4.2 /api/scorecard — Response

{
  efficiencyScore: number;        // 0..10
  narratives: string[];           // up to 6 bullets, layman Spanish
  suggestedFocus?: "optimize_spend" | "improve_sales" | "change_channel" | "choose";
}

4.3 /api/persona — Request

{
  personaType: string;
  businessType: string;
  city?: string;
  question: string;               // required
  focus?: "efficiency" | "conversion" | "insight";
  patientsPerMonth?: number;
  avgTicket?: number;
  adSpend?: number;
  mainChannel?: string;
  supportChannels?: string[];
  returnRate?: string;
}

4.4 /api/persona — Response

{
  ok: true,
  persona: string,                // name
  industry: string,               // resolved
  askedQuestion: string,
  reaction: string,               // short reaction (≤25 words)
  answerToQuestion: string,       // 2–4 sentences, direct to the asked question
  dudasCliente: string[],         // 3–6 items
  sugerencias: string[],          // 3–6 items
  conversionLikelihood: number,   // 0..10
  insights?: {
    whatClientWantsSummary: string;
    whatToDoThisWeek: string[];   // concrete steps (with pesos)
    expectedImpact: string[];     // rough math estimation
    howToKnow: string[];          // leading indicators / KPIs
    howToTalk: string[];          // tone & channel tactics
  } | null
}


⸻

5) Prompts & Guardrails

5.1 Scorecard (LLM)
  • System: “Consultor que explica en español sencillo; no usar jerga (‘ROAS’, ‘CPL’), máximo 6 viñetas.”
  • User: Packed with normalized numbers; instructs phrasing (“con tu inversión actual…”, “lo normal en tu sector…”).

5.2 Persona Q&A
  • System: “Eres {Persona} pero respondes como cliente real de {Industria} en {Ciudad}. Tono WhatsApp. Primero responde la pregunta exacta (2–4 frases). Luego dudas y señales de confianza. Prohíbe voz consultor.”
  • Drift guard: If health terms appear in a non-health industry (or similar mismatch), retry with “corrige: habla SOLO como cliente de {Industria}”.

5.3 Insights
  • Derived programmatically in aiNarrative.ts, combining:
  • Benchmarks by channel.
  • User math (CPL, spend target, rough ROAS, repetition proxy).
  • Persona bullets (doubts/suggestions) → summarized to one sentence.
  • Question-aware addition (ad-click, price, trust, return).

⸻

6) Scoring Model

efficiencyScore = round(
  0.45 * cplMainScore +
  0.25 * roasScore +
  0.30 * spendRatioScore
)

  • cplMainScore: normalize CPL vs. [lo, hi] for main channel → 0..10
  • roasScore: simple proxy vs. roasTarget → 0..10
  • spendRatioScore: distance to 1.0 (within ±20% is ok) → 0..10

Bench sources:
  • industry.bench (preferred) → persona.bench (fallback) → defaults.

⸻

7) Sequence Diagrams

7.1 Scorecard

User → IntakeForm → POST /api/scorecard
ScorecardAPI:
  • normalize channels
  • fetch persona/industry benches
  • compute math → NarrativeInputs
  • LLM: buildAIDiagnostic() (fallback to stub on error)
  • respond {efficiencyScore, narratives, suggestedFocus}
IntakeForm ← render Scorecard

7.2 Q&A + Insights

User selects focus + question → IntakeForm → POST /api/persona
PersonaAPI:
  • build system + user prompts (question-aware)
  • call OpenAI (json mode)
  • drift guard retry if domain leak
  • compute insights via buildActionableInsights()
  • respond with: answerToQuestion, dudas, sugerencias, likelihood, insights
IntakeForm ← render Q&A + Insights


⸻

8) Error Handling
  • Validation: zod on both APIs → 400/500 with details.
  • LLM failures:
  • Scorecard: fall back to deterministic buildNarrativeStub().
  • Persona Q&A: 500 if JSON parse fails twice (first + retry).
  • UI: shows inline errors under inputs and in Q&A panel.

⸻

9) Environments
  • Local: PORT=3001 npm run dev
  • Vercel: main (prod), develop (staging).
  • OPENAI_API_KEY must be set in Project → Settings → Environment Variables.
  • Build strictness: next.config.ts can disable Typescript/ESLint blocking for faster CI while refactoring.

⸻

10) Extension Points
  • Benchmarks: industryProvider / personaProvider → add per-channel CPLs or ROAS targets.
  • Starter questions: adjust sets by industry/focus in IntakeForm.
  • More guardrails: add industry-specific regex checks in persona/route.ts.
  • Persistence: store scorecards and conversations in a DB for history/trends.
  • A/B prompts: read prompts from src/prompts/** and experiment per industry.

⸻

11) File Map (most relevant)

src/
├─ app/
│  ├─ api/
│  │  ├─ scorecard/route.ts      # números + narrativa
│  │  └─ persona/route.ts        # Q&A + insights + drift guard
│  └─ page.tsx                   # entry (imports IntakeForm)
├─ components/
│  ├─ IntakeForm.tsx             # UI principal
│  ├─ PersonaSelect.tsx
│  ├─ IndustrySelect.tsx
│  └─ CitySelect.tsx
├─ lib/
│  ├─ aiNarrative.ts             # LLM narrative + insights builder
│  ├─ industryProvider.ts        # industry benches
│  └─ personaProvider.ts         # persona metadata/context
└─ prompts/
   └─ action-card.ts             # (future) prompt experiments


⸻

12) Sample Curl (Manual Testing)

# Scorecard
curl -sS -X POST http://localhost:3001/api/scorecard \
  -H "Content-Type: application/json" \
  -d '{
    "personaType":"nutriologa",
    "businessType":"bienesraices",
    "city":"Monterrey",
    "patientsPerMonth":10,
    "avgTicket":10000,
    "mainChannel":"referidos",
    "adSpend":4000,
    "returnRate":"1",
    "supportChannels":["facebook"]
  }' | jq

# Persona (question-aware)
curl -sS -X POST http://localhost:3001/api/persona \
  -H "Content-Type: application/json" \
  -d '{
    "personaType":"nutriologa",
    "businessType":"bienesraices",
    "city":"Monterrey",
    "question":"¿Qué te haría dar clic en un anuncio mío sin dudar?",
    "patientsPerMonth":10,
    "avgTicket":10000,
    "adSpend":4000,
    "mainChannel":"referidos",
    "supportChannels":["facebook"],
    "returnRate":"1"
  }' | jq


⸻

13) Known Limitations
  • ROAS es un proxy simple (ingresos estimados / adSpend). Ajustar según embudos reales si se dispone de más datos.
  • Benchmarks son globales por industria/canal; podrían especializarse por ciudad/segmento.
  • Insights son heurísticos; no reemplazan un media plan completo.

⸻

14) Glossary (User-Friendly)
  • Costo por cliente: lo que te cuesta conseguir a un cliente nuevo con tu inversión.
  • Rango saludable de inversión: lo sugerido para tu situación, para no quedarte corto ni gastar de más.
  • Pruebas reales: fotos/videos/testimonios verificables que aumentan la confianza.
  • Paquete post-visita: material que envías después de una visita para cerrar dudas y fomentar referidos.

⸻

End of Architecture
MD