Contributing to Synthetic Persona Web

Thanks for your interest in contributing! This guide will help you set up your environment, understand the workflow, and follow our standards.

⸻

🛠 Development Setup

1. Clone the Repository

git clone https://github.com/breyesr/synthetic-persona-web.git
cd synthetic-persona-web

2. Install Dependencies

npm install

3. Run Locally

PORT=3001 npm run dev

Then open http://localhost:3001

4. Environment Variables

Create a .env.local file in the root of the project:

OPENAI_API_KEY=your-openai-api-key

Required:
  • OPENAI_API_KEY → Needed for persona Q&A and actionable insights. Without it, the app falls back to deterministic stubs.

Optional:
  • PORT → Defaults to 3000; override with your preferred port.
  • Next.js Telemetry can be disabled: npx next telemetry disable

5. Code Standards
  • Language: TypeScript + React (Next.js App Router)
  • Style: ESLint + Prettier enforced.
  • No any types unless explicitly justified.
  • Components follow functional React with hooks.

6. Git Workflow
  • Default branch: main (production)
  • Development branch: develop
  • Feature branches: feat/<short-description>
  • Bugfix branches: fix/<short-description>

Workflow:

git checkout develop
git pull origin develop
git checkout -b feat/my-new-feature

Open a PR into develop. Once approved, merges to main will auto-deploy to Vercel.

7. Commit Conventions

Follow Conventional Commits:
  • feat: – new feature
  • fix: – bug fix
  • docs: – documentation only changes
  • refactor: – code changes that neither fix a bug nor add a feature
  • chore: – maintenance tasks

Example:

git commit -m "feat(scorecard): improve CPL calculation logic"

8. Testing

Currently lightweight:
  • Manual testing via local dev.
  • Use starter questions in the IntakeForm to verify persona Q&A changes.
  • Ensure outputs remain coherent (Scorecard → Q&A → Insights).

9. Project Structure

src/
 ├─ app/
 │   ├─ api/
 │   │   ├─ scorecard/route.ts   # Scorecard API
 │   │   ├─ persona/route.ts     # Persona Q&A + Insights API
 │   │   ├─ ...
 │   └─ page.tsx                # App entry
 ├─ components/
 │   ├─ IntakeForm.tsx          # Main UI form
 │   ├─ PersonaSelect.tsx
 │   ├─ IndustrySelect.tsx
 │   ├─ CitySelect.tsx
 ├─ lib/
 │   ├─ aiNarrative.ts          # Scorecard + Insights logic
 │   ├─ personaProvider.ts      # Persona context
 │   ├─ industryProvider.ts     # Industry benchmarks
 └─ prompts/                    # Prompt definitions

10. Deployment
  • Hosted on Vercel.
  • Every push to main triggers a production build.
  • Every PR deploys to a Vercel preview URL.

11. Documentation
  • /docs/README.md → Project overview & quickstart.
  • /docs/architecture.md → High-level system architecture.
  • /docs/contributing.md (this file) → Development guide.

12. How to Contribute
  1.  Fork the repo & create a branch.
  2.  Make your changes.
  3.  Run locally & test thoroughly.
  4.  Commit using Conventional Commit message.
  5.  Open a PR into develop.

⸻

✨ Notes for Contributors
  • Goal of MVP:
  • Take minimal user inputs.
  • Return: Scorecard (numbers), Persona Q&A (human voice), Insights (actions).
  • LLM dependency: OpenAI is used, but fallback stubs keep the app working offline.
  • Keep it simple: Always prefer clarity in Spanish for end-user outputs.

Happy coding 🚀