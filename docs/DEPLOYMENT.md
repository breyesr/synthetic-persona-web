# Deployment Guide — Synthetic Persona Web (v2)

This document explains how to deploy the application to production using Vercel, including the new database requirements.

---

## 1. Prerequisites
*   GitHub repository with the project code.
*   Vercel account linked to GitHub.
*   Node.js and Docker installed locally for running setup scripts.

---

## 2. Environment Variables

The following variables must be set in your Vercel Dashboard under **Project → Settings → Environment Variables**.

| Variable         | Required For | Description                                                                                    |
| ---------------- | ------------ | ---------------------------------------------------------------------------------------------- |
| `POSTGRES_URL`   | Production   | The connection string for your Vercel Postgres (Neon) database.                                |
| `OPENAI_API_KEY` | Production   | Your secret key for the OpenAI API.                                                            |
| `LLAMA_CLOUD_API_KEY` | Future Use   | For Phase 2 PDF parsing. Can be left blank for now.                                            |

**Important**: Ensure these variables are available during the **Build Phase** by checking the appropriate scopes in the Vercel UI.

---

## 3. Vercel Deployment

### First-Time Setup

1.  Go to **Vercel Dashboard → Add New Project**.
2.  Import your GitHub repository (`synthetic-persona-web`).
3.  **Create and Link a Database**:
    *   In the project configuration, navigate to the **Storage** tab.
    *   Select **Postgres** (provided by Neon) and create a new database.
    *   Connect the new database to your project. This should automatically add the `POSTGRES_URL` environment variable.
4.  **Add Remaining Environment Variables**: Go to **Settings → Environment Variables** and add your `OPENAI_API_KEY`.
5.  Click **Deploy**. The first build will likely fail or result in a non-functional app because the database is empty. Proceed to the next step.

### Step 4: Populate the Production Database (Critical)

For the deployed application to work, its database must be set up and seeded with data. This is done by running the local scripts but pointing them at the remote Vercel database.

1.  **Get Production DB URL**: Copy the `POSTGRES_URL` value from your Vercel project's environment variables.
2.  **Run `db:setup` for Production**: In your local terminal, run the following command, pasting the URL you copied:
    ```bash
    POSTGRES_URL="YOUR_VERCEL_CONNECTION_STRING" npm run db:setup
    ```
3.  **Run `embed` for Production**: Now, run the ingestion script, again targeting the production database:
    ```bash
    POSTGRES_URL="YOUR_VERCEL_CONNECTION_STRING" OPENAI_API_KEY="YOUR_OPENAI_KEY" npm run embed
    ```

### Subsequent Deployments
*   `main` branch auto-deploys to production.
*   Pull Requests auto-deploy to preview URLs.
*   If you change the data in `/data`, you must re-run the `embed` script (Step 4.3) against the production database to see the changes reflected in your deployment.

---

## 5. Troubleshooting

*   **Build Error: `Database connection string is not set`**
    *   **Cause**: The `POSTGRES_URL` is not available during the build step.
    *   **Fix**: Go to your Vercel Environment Variables settings and ensure `POSTGRES_URL` is configured to be available for the **Build** environment (in addition to Preview/Production).

*   **Preview App loads but shows errors or no data.**
    *   **Cause**: You have not populated the production/preview database yet.
    *   **Fix**: Follow the steps in "Populate the Production Database" above to run the `db:setup` and `embed` scripts.

*   **500 error on API routes.**
    *   **Cause**: `OPENAI_API_KEY` is likely missing or invalid in your Vercel environment variables.
    *   **Fix**: Verify the key in Vercel settings.

---

*For local development setup, branching strategy, and rollback instructions, please refer to `CONTRIBUTING.md` and the original sections of this guide.*