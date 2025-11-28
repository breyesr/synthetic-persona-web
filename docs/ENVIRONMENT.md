# Environment Configuration

This document describes the environment configuration for the Synthetic Persona Web application, including the new database requirements.

---

## 1. Node & Framework Versions
*   **Node.js**: >=20.x
*   **Next.js**: 15.x
*   **TypeScript**: 5.x
*   **Package Manager**: npm

---

## 2. Environment Variables

All sensitive or environment-dependent values should be defined via `.env.local` (for local development) or through Vercel’s Environment Variables UI (for preview/production deployments).

### Core Variables

| Variable               | Scope    | Description                                                                                                   |
| ---------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`       | All      | **Required**. API key for OpenAI, used for embeddings and chat completions.                                     |
| `POSTGRES_URL_LOCAL`   | Local    | **Required for Local Dev**. The connection string for the local Docker-based Postgres database.                   |
| `POSTGRES_URL`         | Vercel   | **Required for Deployment**. The connection string for the production/preview Vercel Postgres (Neon) database.    |
| `LLAMA_CLOUD_API_KEY`  | All      | **Optional (Future)**. The API key for LlamaParse, which will be used for PDF ingestion in Phase 2.           |

---

## 3. Local Environment Setup

1.  **Copy the example file**:
    ```bash
    cp .env.example .env.local
    ```

2.  **Edit `.env.local`**: Add your `OPENAI_API_KEY`. The `POSTGRES_URL_LOCAL` is already pre-configured for the Docker setup.

    **Example `.env.local`:**
    ```env
    # For local Docker database
    POSTGRES_URL_LOCAL="postgresql://user:password@localhost:5433/persona_db"

    # For OpenAI API
    OPENAI_API_KEY="sk-xxxxxx"
    ```

---

## 4. Vercel Environments (Preview & Production)

For both Preview and Production deployments on Vercel, the following variables must be set in the Vercel Dashboard under **Project → Settings → Environment Variables**.

*   `POSTGRES_URL`: This is set automatically when you integrate a Vercel Postgres (Neon) database with your project. **Ensure it is available to the Build environment.**
*   `OPENAI_API_KEY`: You must add your OpenAI key manually.

---

## 5. Security Best Practices
*   Never commit `.env.local` or other files containing secrets to Git.
*   Use the "Sensitive" setting in Vercel for API keys so they cannot be viewed after being set.
*   Keep `.env.example` updated whenever new variables are introduced so other developers are aware of new requirements.