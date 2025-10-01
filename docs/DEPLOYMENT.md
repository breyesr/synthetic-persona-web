Deployment Guide — Synthetic Persona Web

This document explains how to deploy Synthetic Persona Web to production using Vercel. It also covers environment variables, branch strategy, and troubleshooting.

⸻

1. Prerequisites
  • GitHub repository with the project code (main branch is production-ready).
  • Vercel account linked to GitHub.
  • Node.js 18+ installed locally for testing.
  • Required environment variables (see .env.example).

⸻

2. Environment Variables

Set these variables in Vercel Dashboard → Project → Settings → Environment Variables:
  • OPENAI_API_KEY → API key from OpenAI (required).
  • PORT → Optional, defaults to 3000 locally. Not required in Vercel.

For local development, create a file named .env.local with:

OPENAI_API_KEY=sk-xxxx
PORT=3001


⸻

3. Local Deployment (Testing Before Push)

# Install dependencies
yarn install   # or npm install

# Run local dev server
PORT=3001 npm run dev

# Open in browser
http://localhost:3001


⸻

4. Vercel Deployment

First-Time Setup
  1.  Go to Vercel Dashboard → Add New Project.
  2.  Import GitHub repo synthetic-persona-web.
  3.  Set root directory (usually /).
  4.  Add environment variables.
  5.  Deploy.

Subsequent Deployments
  • Main branch auto-deploys to production URL: https://synthetic-persona-web.vercel.app
  • Feature branches deploy to preview URLs automatically (e.g., https://feat-scorecard.vercel.app).

⸻

5. Branch Strategy
  • main → Stable production.
  • develop → Integration branch.
  • feat/* → Feature work. Each feature branch will get its own preview deployment.

Workflow:
  1.  Work on feat/* branch locally.
  2.  Push to GitHub → Vercel creates preview deployment.
  3.  Merge into develop for integration testing.
  4.  Merge into main for production release.

⸻

6. Troubleshooting

Common Issues
  • Lint/Type errors blocking build → We configured next.config.ts to skip ESLint/TS errors in production. If strict typing is required, fix before merge.
  • 500 error on API routes → Ensure OPENAI_API_KEY is set correctly in Vercel.
  • Deployment not updating → Clear build cache in Vercel → Redeploy.

Debugging a Preview Deployment
  1.  Open preview URL from Vercel.
  2.  Use DevTools → Network tab to inspect API calls.
  3.  If needed, run locally with the same branch:

git checkout feat/my-feature
npm install
npm run dev



⸻

7. Rollback Strategy

If production deploy introduces a bug:
  1.  Go to Vercel Dashboard → Project → Deployments.
  2.  Find the last good deployment.
  3.  Click Promote to Production.

This instantly rolls back without code changes.

⸻

8. Future Improvements
  • Add staging project in Vercel for QA before production.
  • Automate lint/type checks with GitHub Actions.
  • Add monitoring for API errors and response times.

⸻

✅ With this guide, any developer should be able to:
  • Run locally.
  • Deploy to Vercel.
  • Debug issues.
  • Rollback safely.