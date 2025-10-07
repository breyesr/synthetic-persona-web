Changelog

All notable changes to Synthetic Persona Web will be documented in this file.
This project adheres to Semantic Versioning and follows a simplified Keep a Changelog format.

⸻

[Unreleased]
  • Add multi-language support (EN/ES switch).
  • Persona image/avatar generation.
  • Export results to PDF and CSV.
  • Admin dashboard for benchmark management.


⸻

[0.3.0] - 2025-10-06

Added
  • **/consultas page:** new standalone interface for persona Q&A.
    - Persona selector connected to `/api/personas`.
    - Industry dropdown (“Tu industria”) for context-aware replies.
    - Input field with guided prompt (“Soy [Persona]. Pregúntame algo…”).
    - Server-side POST `/api/persona` integration returning structured responses (reaction, answer, doubts, trust signals, conversion likelihood).
    - Clean, responsive UI (rounded cards, indigo primary button, minimal layout).

  • **Documentation Expansion:** 
    - Added `docs/CONSULTAS.md` with endpoint, UI, and dev notes.
    - Added `docs/UX Wireframes.md` and `docs/Design System.md` for design clarity.
    - Updated `README.md`, `ARCHITECTURE.md`, and `API.md` to reflect new page and endpoints.

Changed
  • Unified naming conventions for industry fields (`businessType` → “Tu industria”).
  • Minor UI polish (padding, text hierarchy, card consistency).
  • Persona answer rendering now respects Markdown line breaks for clarity.

Notes
  • The `/consultas` page uses the same OpenAI backend as Scorecard and Insights.
  • Planned next: multi-turn persona memory and conversation history export.

⸻

[0.2.0] - 2025-10-01

Added
  • Persona Q&A direct answers: Personas now reply specifically to user questions in first person (answerToQuestion).
  • Insights contextualization: Actionable insights now include steps and KPIs tied to the actual asked question.
  • How to Talk section: Communication guidance for each persona based on channels, tone, and ticket size.
  • Docs suite: Added README.md, ARCHITECTURE.md, CONTRIBUTING.md, DEPLOYMENT.md, ENVIRONMENT.md, API.md, and TESTING.md.

Changed
  • Improved scorecard narrative: clarified client vs. lead ambiguity and refined ROAS explanation.
  • Enhanced buildActionableInsights to summarize client wants in one sentence.
  • Deployment build: added next.config.js override to bypass strict ESLint/TS checks.

Fixed
  • Drift guard for persona Q&A to prevent cross-industry bleed (e.g., nutrition terms in real estate personas).
  • IntakeForm UI now echoes the asked question and displays persona’s direct answer.

⸻

[0.1.0] - 2025-09-20

Added
  • Initial MVP release.
  • Scorecard: efficiency score, CPL/ROAS diagnostics with LLM + fallback.
  • Persona Q&A: natural-language replies in first person with doubts, suggestions, and likelihood of conversion.
  • Insights: actionable steps, expected impact, KPIs, and trust-building tactics.
  • Vercel Deployment with GitHub integration.

Known Issues
  • Some ESLint strict typing errors suppressed for deployment.
  • Q&A answers not yet tied to asked question (fixed in 0.2.0).

⸻

Format Notes
  • Each entry includes: Added, Changed, Fixed, Removed (if applicable).
  • Dates follow YYYY-MM-DD.
  • Keep Unreleased at the top for pending changes.