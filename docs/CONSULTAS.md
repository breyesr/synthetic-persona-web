CONSULTAS Page (Conversational Persona Q&A)

This page lets a user pick a persona and their own industry, ask a free‑form question, and get a first‑person answer plus doubts, trust signals, and a purchase likelihood.

⸻

URL & Ownership
	•	Route: /consultas
	•	Component: src/app/consultas/page.tsx
	•	Shared UI: src/components/PersonaSelect.tsx, src/components/IndustrySelect.tsx

⸻

Purpose
	•	Validate ideas, value props, pricing clarity, and messaging from the customer’s voice.
	•	Fast iteration loop: select persona → pick your industry → ask → read answer.
	•	Output is actionable (what they need to see, how likely they are to buy).

⸻

Data Flow (Request → Response)
	1.	GET /api/personas → populate persona selector (array of { id, name }).
	2.	GET /api/industries → populate industry selector (array of { id, name }).
	3.	POST /api/persona with { personaType, businessType, question } (+optional city/metrics)
→ JSON with reaction, answerToQuestion, dudasCliente[], sugerencias[], conversionLikelihood.

Note: /api/personas in this project returns { "options": [{ id, name }, ...] } (MVP). The page normalizes it to an array.

⸻

Endpoints (contracts used by this page)

GET /api/personas

Used for: persona dropdown.

Example response

{
  "options": [
    { "id": "medestetica",  "name": "Dra. Fernanda Medicina Estética" },
    { "id": "odontologa",   "name": "Dra. Karla la Odontóloga" },
    { "id": "psicologo",    "name": "Lic. Andrés el Psicólogo" },
    { "id": "fisioterapeuta","name": "Lic. Jorge el Fisioterapeuta" },
    { "id": "nutriologa",   "name": "Lic. Mariana la Nutrióloga" }
  ]
}

GET /api/industries

Used for: industry dropdown (the user’s own industry).

Example response (truncated)

{
  "items": [
    { "id": "salud",        "name": "Salud" },
    { "id": "bienesraices", "name": "Bienes Raíces" }
  ]
}

POST /api/persona

Used for: sending the user’s question to the selected persona.

Minimal request body

{
  "personaType": "nutriologa",
  "businessType": "bienesraices",
  "question": "¿Qué te haría probar un nuevo desarrollo inmobiliario?"
}

Example response

{
  "ok": true,
  "persona": "Lic. Mariana la Nutrióloga",
  "industry": "Bienes Raíces",
  "askedQuestion": "¿Qué te haría probar un nuevo desarrollo inmobiliario?",
  "reaction": "Si veo precios claros, ubicación exacta y fotos reales, me interesa mucho.",
  "answerToQuestion": "Muéstrame el rango de precios desde el inicio, la zona exacta y el paso a paso. Si veo un video real del lugar y puedo escribir por WhatsApp sin presión, sí lo consideraría.",
  "dudasCliente": [
    "¿Cuál es la ubicación exacta y qué tan accesible es?",
    "¿Qué costos adicionales debo considerar?",
    "¿Qué tan rápido podría rentarse o revenderse?"
  ],
  "sugerencias": [
    "Rango ‘desde–hasta’ visible",
    "Fotos/video reales",
    "Testimonios verificables",
    "WhatsApp directo"
  ],
  "conversionLikelihood": 7
}


⸻

UI Structure

Header
	•	Title: “Habla con una Persona Sintética”.
	•	Short subtitle (optional): “Valida ideas y mensajes en voz de tu cliente ideal”.

Controls Card
	•	Grid (2 cols on md, 1 on mobile):
	•	Persona → PersonaSelect (populated from /api/personas).
	•	Tu industria → IndustrySelect (from /api/industries).
	•	Question → textarea labeled: “Escríbele a {Persona}”.
	•	Placeholder: “Soy {Persona}. Pregúntame algo para empezar — puedo evaluar ideas, servicios o productos; también darte ideas de cómo ofrecerme tus productos/servicios.”
	•	Primary button → Preguntarle a {Persona} (disabled unless persona + industry + question).
	•	Error line → red text under the card when an error occurs.

Response Card (when available)
	•	H2: “Respuesta de {persona} — {industry}”.
	•	Answer bubble: answerToQuestion (first‑person, 2–4 frases).
	•	Three columns (stack on mobile):
	1.	Dudas (dudasCliente[])
	2.	Qué le daría confianza (sugerencias[])
	3.	Probabilidad de comprar (conversionLikelihood/10)

States
	•	Loading: button shows “Preguntando…”, disabled.
	•	Disabled: until the three fields have values.
	•	Error: show message under the controls card.

⸻

Developer Notes
	•	This page only calls /api/persona (no scorecard math involved here).
	•	The persona name from the dropdown is echoed in labels/CTAs to keep context tight.
	•	We purposefully do not persist questions/answers (MVP). Add DB if history is needed.
	•	All LLM calls run server‑side. Ensure OPENAI_API_KEY is configured.
	•	If the GET /api/personas response uses { options: [...] }, normalize to an array before passing into PersonaSelect.

⸻

Local Testing

Run dev server

PORT=3001 npm run dev

Open http://localhost:3001/consultas and:
	1.	Pick a persona and your industry.
	2.	Type a question.
	3.	Click “Preguntarle a {Persona}”.

Direct cURL (bypassing UI)

curl -sS -X POST http://localhost:3001/api/persona \
  -H "Content-Type: application/json" \
  -d '{
    "personaType": "nutriologa",
    "businessType": "bienesraices",
    "question": "¿Qué te haría dar clic en un anuncio mío sin dudar?"
  }' | jq


⸻

Error Handling & Edge Cases
	•	400/500 from /api/persona → show error line; user can retry.
	•	Empty personas/industries → disable Ask button and show a helper message.
	•	Long answers → keep bubble width responsive; allow wrapping.

⸻

Future Enhancements
	•	Starter question presets by industry/persona on this page.
	•	Optional city select to enrich context.
	•	Save conversation history per session.
	•	Quick actions: “Pedir ideas de anuncios”, “Pedir objeciones comunes”, etc.