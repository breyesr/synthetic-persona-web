ENVIRONMENT.md

This document describes the environment configuration for Synthetic Persona Web. It defines required environment variables, recommended defaults, and best practices for local, staging, and production deployments.

⸻

1. Node & Framework Versions
  • Node.js: >=20.x
  • Next.js: 15.x (App Router with Turbopack)
  • TypeScript: 5.x
  • Package Manager: npm

Ensure consistency by using the .nvmrc file or explicitly setting Node version in your environment.

⸻

2. Environment Variables

All sensitive or environment-dependent values should be defined via .env.local (for local) or through Vercel’s Environment Variables UI (for staging/production).

Core Variables
  • OPENAI_API_KEY → Required. API key for OpenAI (used for scorecard narratives, persona Q&A, and insights).
  • PORT → Local dev port (default: 3000 if unset, we use 3001).

Vercel-specific
  • VERCEL_ENV → Provided automatically by Vercel (development, preview, production).
  • VERCEL_URL → Auto-set with deployment URL.

Optional / Future-Proofing
  • LOG_LEVEL → Set verbosity for logging (debug, info, warn, error). Default: info.
  • DISABLE_TELEMETRY → If true, disables any non-essential telemetry.

⸻

3. Environment Files
  • .env.local → Local overrides, not committed.
  • .env.development → Defaults for local dev (safe values).
  • .env.production → Production-only secrets (e.g., API keys).

Note: Only .env.example is committed. It lists all required variables with dummy values so contributors know what to configure.

⸻

4. Local Environment Setup

# Copy example file
cp .env.example .env.local

# Edit with your own secrets
nano .env.local

Example .env.local:

OPENAI_API_KEY=sk-xxxxxx
PORT=3001
LOG_LEVEL=debug

Run the app locally:

npm install
PORT=3001 npm run dev

Access: http://localhost:3001

⸻

5. Staging / Preview Environment

On Vercel:
  1.  Go to Project → Settings → Environment Variables.
  2.  Add OPENAI_API_KEY and any optional variables.
  3.  Set scope = Preview.

Preview branches (feat/*) automatically deploy with these vars.

⸻

6. Production Environment
  • Same setup in Vercel dashboard, but scope = Production.
  • Ensure the correct OPENAI_API_KEY for production workloads.
  • Use LOG_LEVEL=info (or warn) to reduce noise.

⸻

7. Security Best Practices
  • Never commit .env.local or .env.production.
  • Rotate API keys at least every 90 days.
  • Use Vercel Secrets for sensitive values.
  • Keep .env.example updated whenever new vars are introduced.

⸻

8. Troubleshooting
  • App won’t start (Missing API key) → Check OPENAI_API_KEY is set.
  • Port already in use → Change PORT in .env.local (e.g., 3002).
  • Environment mismatch → Run echo $VERCEL_ENV to confirm context.

⸻

9. Checklist for New Developers
  • Install Node.js 20.x and npm.
  • Copy .env.example → .env.local.
  • Add your own OPENAI_API_KEY.
  • Run npm install && npm run dev.
  • Open http://localhost:3001.

If everything compiles, your environment is ready.