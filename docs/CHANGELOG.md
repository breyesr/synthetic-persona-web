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