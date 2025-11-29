# Contributing to Synthetic Persona Web

Thanks for your interest in contributing! This guide will help you set up your environment, understand the workflow, and follow our standards.

---

## 🛠 Development Setup ("Zero-to-Hero")

This guide will take you from a fresh clone to a fully running local environment. It assumes you have **Node.js**, **npm**, and **Docker Desktop** installed.

#### 1. Clone the Repository
```bash
git clone https://github.com/breyesr/synthetic-persona-web.git
cd synthetic-persona-web
```

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Configure Environment Variables
Create your local environment file from the example.
```bash
cp .env.example .env.local
```
Now, edit the new `.env.local` file and add your `OPENAI_API_KEY`. The `POSTGRES_URL_LOCAL` is already configured for the Docker setup.

#### 4. Start the Local Database
With Docker Desktop running, start the Postgres database container.
```bash
docker-compose up -d
```
This starts a database on port `5433` that persists between restarts.

#### 5. Set Up Database Schema
Create the `documents` table and indexes in your local database.
```bash
npm run db:setup
```

#### 6. Seed the Database (Ingestion)
Process the local files in `/data`, generate embeddings, and load them into your database.
```bash
npm run embed
```

#### 7. Run the Application
Finally, run the Next.js development server.
```bash
npm run dev
```
The application will be available at `http://localhost:3000`.

---

## ✍️ Managing Content (Ingestion Runbook)

The vector database is not automatically updated. You must re-run the ingestion script when you change the source content.

#### How to Add New Content
Place new JSON persona files (or PDFs in the future) into the `/data` directory or its subdirectories.

#### How to Index New Content
After adding or modifying files, run the `embed` script from your terminal:
```bash
npm run embed
```
The script will find your new files, create embeddings, and add them to the database.

#### How to Delete Old Content
Simply **delete the source file** from the `/data` directory. The next time you run `npm run embed`, the script's cleanup process will automatically find and delete all chunks associated with that missing file from the database.

---

## 🏗️ Project Structure (v2)

`src/`
 ├─ `app/`
 │   ├─ `api/`
 │   │   ├─ `persona/route.ts`      # Streaming RAG-powered Q&A API
 │   │   └─ `stress-test/route.ts`  # RAG-powered Stress Test API
 │   └─ `page.tsx`                  # Landing intake + scorecard + persona Q&A UI
 ├─ `components/`
 │   └─ ... (UI components)
 ├─ `lib/`
 │   ├─ `clients.ts`              # Initializes and exports DB and OpenAI clients
 │   ├─ `rag.ts`                  # Core hybrid search logic
 │   ├─ `personaProvider.ts`      # Reads persona files and enriches with RAG context
 │   ├─ ... (other providers)
 └─ `data/`
     ├─ `personas/`               # Source documents for persona data
     └─ ... (other source data)

---

##  Git Workflow & Commit Conventions

*   **Branches**: `main` (production), `develop` (staging), `feat/*` (features), `fix/*` (bugfixes).
*   **Workflow**: Create feature branches off `develop`. Open PRs against `develop`. Merges to `main` are for production releases.
*   **Commits**: Follow [Conventional Commits](https://www.conventionalcommits.org/).
    *   `feat:` (new feature), `fix:` (bug fix), `docs:` (documentation), `refactor:` (code cleanup), `chore:` (build tasks).

---

## 🚀 Deployment

Deployment is handled via Vercel. Every push to a PR creates a Preview Deployment, and every merge to `main` deploys to production. See `docs/DEPLOYMENT.md` for more details, including how to populate the production database.
