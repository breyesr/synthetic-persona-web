Testing Synthetic Persona Web

This document explains how to test the Synthetic Persona Web project end-to-end: locally, in CI, and in production.

⸻

1. Testing Philosophy
  • Deterministic where possible: numerical calculations (e.g., cost per lead, efficiency scores) are unit tested with known inputs/outputs.
  • LLM responses guarded: prompts validated against schemas (zod) + drift detection ensures outputs remain in-domain.
  • End-to-end focus: flows from IntakeForm → API routes → OpenAI → UI render are tested via integration tests.

⸻

2. Local Testing

Run dev server

PORT=3001 npm run dev

Unit tests

npm run test

  • Framework: Jest + React Testing Library
  • Scope:
  • src/lib/aiNarrative.ts – numeric stubs, insight builder.
  • src/app/api/scorecard/route.ts – efficiency score calculation.
  • src/app/api/persona/route.ts – schema validation & drift guard.

Integration tests

npm run test:integration

  • Scope:
  • IntakeForm → /api/scorecard response shape.
  • IntakeForm → /api/persona response shape.
  • End-to-end flow with mocked OpenAI API.

Mocking OpenAI
  • Use OPENAI_API_KEY="mock" to trigger stubbed responses from aiNarrative.ts.
  • Ensures local tests run without hitting the API.

⸻

3. Continuous Integration (CI)
  • CI runs on GitHub Actions (see .github/workflows/test.yml).
  • Jobs:
  1.  Install dependencies.
  2.  Lint (npm run lint).
  3.  Type-check (npm run typecheck).
  4.  Run tests (npm run test).
  • PRs must pass CI before merging.

⸻

4. Manual QA Checklist

Before merging to main or deploying:

Scorecard
  • Inputs → Outputs match expected CPL, spend target, efficiency score.
  • Spanish phrasing is layman-friendly, no jargon.

Persona Q&A
  • Persona answers the exact asked question in 2–4 sentences.
  • Doubts + Suggestions reflect the industry, not original profession.
  • Conversion likelihood within 0–10 scale.

Insights
  • whatClientWantsSummary makes sense given doubts/suggestions.
  • whatToDoThisWeek are concrete, MX$ amounts included.
  • expectedImpact uses math consistent with scorecard.
  • howToTalk matches channels (WhatsApp, Facebook, etc.).

⸻

5. Production Monitoring

Logs
  • Vercel logs: monitor /api/scorecard and /api/persona latency + error rates.
  • Look for Malformed model output errors → usually schema drift.

Health checks
  • Run curl against live endpoints:

curl -X POST https://<deployment-url>/api/scorecard -d '{...}'
curl -X POST https://<deployment-url>/api/persona -d '{...}'

Alerts
  • Suggested: integrate Vercel → Slack alerts for failed builds or high error rates.

⸻

6. Common Issues
  • LLM outputs empty/invalid JSON → Schema validation catches; retry logic built-in.
  • Off-domain answers (e.g., persona reverting to original profession) → Drift guard triggers a retry.
  • High test flakiness → Mock OpenAI API locally.

⸻

7. Future Enhancements
  • Snapshot testing for UI states (Scorecard, Persona Q&A, Insights).
  • Contract tests for API schemas with zod-to-openapi.
  • Load testing on /api/scorecard for scale simulation.

⸻

✅ With this, contributors can validate correctness locally and in CI before shipping to production.