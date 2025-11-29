API Reference

Synthetic Persona Web exposes a small set of HTTP endpoints used by the web client. All endpoints return JSON.

Base URL examples
  • Local: http://localhost:3001
  • Vercel Preview/Prod: use the deployment URL shown by Vercel

Auth: None (MVP). Behind the scenes, LLM calls are protected via server‑side API keys.

Rate limits: None enforced at gateway (MVP). Prefer client‑side debounce when calling /api/persona.

Errors: Non‑2xx responses include { error: string, details?: any }.

⸻

POST /api/scorecard

Compute a numeric efficiency score (0–10) and a set of layman narratives using the user’s inputs + industry benchmarks. Uses LLM with a deterministic fallback.

Request Body

{
  "personaType": "string",
  "businessType": "string",
  "city": "string",
  "patientsPerMonth": 10,
  "avgTicket": 10000,
  "mainChannel": "facebook",
  "adSpend": 4000,
  "returnRate": "3-4",
  "supportChannels": ["whatsapp", "google"]
}

Field notes:
  • returnRate: one of "0-2"|"3-4"|"5-6"|"7-8"|"9-10"|"No sé".
  • mainChannel & supportChannels: normalized to one of instagram|facebook|tiktok|google|whatsapp|referidos|otros.

Response

{
  "efficiencyScore": 5,
  "narratives": [
    "Con tu inversión actual de MX$4,000 estás cerrando ~10 clientes al mes.",
    "Cada cliente te cuesta ~MX$333 (rango típico ~MX$300–600), hay margen para bajar.",
    "Si optimizas hacia ~MX$250–300, con el mismo presupuesto podrías atraer +3–5 clientes al mes.",
    "Recuperas ~MX$25 por peso invertido; valida medición antes de subir presupuesto.",
    "Repetición directa baja; enfoca referidos con paquete post‑visita.",
    "Refuerza Facebook con prueba social y claridad de precios/proceso."
  ],
  "suggestedFocus": "optimize_spend"
}

Status Codes
  • 200 OK
  • 400 Bad request (validation)
  • 500 Internal error (very rare)

⸻

POST /api/persona

Generates Q&A in first‑person (client voice) and an Insights block that merges the persona’s words with your numbers. Includes a drift guard to keep the answers aligned to the selected industry.

Request Body

{
  "personaType": "string",
  "businessType": "string",
  "city": "string",
  "question": "¿Qué te haría dar clic en un anuncio mío sin dudar?",
  "focus": "insight", 
  "personaContext": "(optional override)",
  "patientsPerMonth": 10,
  "avgTicket": 10000,
  "adSpend": 4000,
  "mainChannel": "referidos",
  "supportChannels": ["facebook"],
  "returnRate": "1"
}

Notes:
  • focus is a soft hint for the tone of the Q&A (efficiency|conversion|insight).
  • Numbers are optional, but required to get Insights.

Response

{
  "ok": true,
  "persona": "Lic. Mariana la Nutrióloga",
  "industry": "Bienes Raíces",
  "askedQuestion": "¿Qué te haría dar clic en un anuncio mío sin dudar?",
  "reaction": "Me interesa si me dicen precios y el proceso sin vueltas.",
  "answerToQuestion": "Dime el rango de precios desde el inicio, zona exacta y el paso a paso. Si veo fotos o video real y puedo escribir por WhatsApp sin presión, sí hago clic.",
  "dudasCliente": ["¿Precio total y mensualidad?", "¿Tiempo y pasos de escrituración?", "¿Zona exacta y seguridad?", "¿Costos extra?"],
  "sugerencias": ["Rango ‘desde–hasta’", "Prueba social verificable", "Video real de la propiedad", "WhatsApp directo"],
  "conversionLikelihood": 7,
  "insights": {
    "whatClientWantsSummary": "Quiere rango de precios, pasos/tiempos y prueba real; contacto directo y cero presión.",
    "whatToDoThisWeek": [
      "Crea 1 anuncio con fotos/video reales + rango de precios + CTA a WhatsApp (‘te explico sin presión’).",
      "Muestra en página/listado pasos y tiempos; botón ‘calcular mensualidad’.",
      "Refuerza Facebook con testimonios verificables."
    ],
    "expectedImpact": [
      "Reduciendo CPL hacia ~MX$250, +3–5 interesados/mes.",
      "A tus tasas, ~2–4 clientes adicionales/mes."
    ],
    "howToKnow": [
      "Más mensajes con la palabra ‘precio’/‘mensualidad’.",
      "CPL acercándose a ~MX$250."
    ],
    "howToTalk": [
      "Tono cercano y cero presión.",
      "En Facebook/IG evita stock y usa subtítulos con ‘precio desde’ y ‘cómo empezar’."
    ]
  }
}

Status Codes
  • 200 OK
  • 400 Bad request (validation)
  • 500 LLM output malformed (guard rails)

GET /api/industries

List available industries (id, name, and any known benchmarks).

Response (truncated)

{
  "items": [
    { "id": "salud", "name": "Salud", "bench": { "cplTargetMXN": [120, 200], "retentionP50": 60 } },
    { "id": "bienesraices", "name": "Bienes Raíces", "bench": { "cplTargetMXN": [300, 600], "retentionP50": 30 } }
  ]
}

Status codes: 200 OK

⸻

GET /api/personas

List available personas used in the intake.

Response (truncated)

{
  "items": [
    { "id": "nutriologa", "name": "Lic. Mariana la Nutrióloga" },
    { "id": "abogado",   "name": "Lic. Jorge el Abogado" }
  ]
}

Status codes: 200 OK

⸻

GET /api/cities

List known cities (static, used to prefill the dropdown).

Response (truncated)

{ "items": ["Monterrey", "Ciudad de México", "Guadalajara"] }

Status codes: 200 OK

⸻

POST /api/action-card (experimental)

Generates a compact “action card” summarizing a recommended next step. Used for prototypes and may change.

Request Body (shape may evolve)

{ "context": { "businessType": "string", "goal": "string" } }

Response (example)

{ "title": "Baja tu costo por cliente a ~MX$250", "steps": ["Publica 2 testimonios verificables", "Video real por propiedad" ] }

Status codes: 200, 400, 500

⸻

Data Contracts (TypeScript)

Scorecard (response)

export type Scorecard = {
  efficiencyScore: number; // 0..10
  narratives: string[];    // layman bullets (max ~6)
  suggestedFocus?: "optimize_spend" | "improve_sales" | "change_channel" | "choose";
};

Persona (response)

export type PersonaReply = {
  reaction: string;            // short 1-liner in first person
  answerToQuestion: string;    // 2–4 sentences answering the exact question
  dudasCliente: string[];      // 3–5
  sugerencias: string[];       // 3–5 (what gives confidence)
  conversionLikelihood: number;// 0..10
  personaName?: string;
  industryName?: string;
  askedQuestion?: string;
  insights?: {
    whatClientWantsSummary: string;
    whatToDoThisWeek: string[];
    expectedImpact: string[];
    howToKnow: string[];
    howToTalk: string[];
  } | null;
};


⸻

Validation & Error Shapes
  • All POST bodies are validated with zod. Expect 400 with { error, details } when fields are missing/invalid.
  • LLM JSON output is schema‑checked. If malformed after a retry, the route returns 500 with { error: "Malformed model output" }.

⸻

LLM Usage & Models
  • Uses OpenAI gpt-4o-mini for:
  • Scorecard narrative rewrite (via buildAIDiagnostic with a deterministic fallback)
  • Persona Q&A + Insights (with domain drift guard and question‑aware tweaks)
  • Temperature: 0.3–0.5 depending on call.
  • All LLM calls are server‑side; API key is never exposed to the browser.

Environment variables required (server):
  • OPENAI_API_KEY

⸻

Versioning & Stability
  • APIs are MVP and may evolve without a formal version prefix.
  • Breaking changes will be noted in CHANGELOG.md and release PRs.

⸻

Examples

cURL (local)

# Scorecard
curl -s -X POST http://localhost:3001/api/scorecard \
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
  }' | jq .

# Persona Q&A + Insights
curl -s -X POST http://localhost:3001/api/persona \
  -H "Content-Type: application/json" \
  -d '{
    "personaType":"nutriologa",
    "businessType":"bienesraices",
    "city":"Monterrey",
    "question":"¿Qué te haría dar clic en un anuncio mío sin dudar?",
    "focus":"insight",
    "patientsPerMonth":10,
    "avgTicket":10000,
    "adSpend":4000,
    "mainChannel":"referidos",
    "supportChannels":["facebook"],
    "returnRate":"1"
  }' | jq .


⸻

Security Notes (MVP)
  • No authentication on read/write endpoints; rely on project privacy and Vercel protections.
  • Rate limiting & auth can be introduced via middleware when needed.

⸻

Troubleshooting
  • 500 on /api/persona: often malformed LLM output; retry. Ensure OPENAI_API_KEY is set.
  • Weird persona domain: check businessType and persona prompt; the route includes a drift guard but garbage‑in → garbage‑out.
  • Build fails on Vercel (ESLint/TS): see next.config.ts settings that ignore lint errors during CI for MVP.
