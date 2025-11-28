# Architecture — Synthetic Persona Web (v2)

This document explains the refactored v2 architecture, which centers around a Postgres-based RAG pipeline for efficient and scalable context retrieval.

---

## 1. High-Level Overview

The application is split into two main phases: **Ingestion** (offline) and **Retrieval** (real-time).

### Ingestion Flow (Offline)

The ingestion process reads source documents, creates vector embeddings, and stores them in a Postgres database. This is done via a local script.

`Source Files -> Chunking -> OpenAI Embeddings API -> Postgres (pgvector)`

### Retrieval & Generation Flow (Real-time)

When a user asks a question, the API retrieves relevant context from the database to construct a prompt for the LLM.

```
           ┌──────────┐     POST /api/persona
Frontend ───▶ API Route├─┐
(React)    │           │ │
           └──────────┘ │
                        │
     ┌──────────────────┘
     │
     │ 1. getPersona(personaId, userQuery)
     ▼
┌──────────────────┐   2. hybridSearch(query, id)   ┌──────────────────┐
│ personaProvider  │───────────────────────────────▶│      rag.ts      │
└──────────────────┘                                └─────────┬────────┘
                                                              │ 3. DB Query
                                                              ▼
                                                     ┌──────────────────┐
                                                     │ Postgres DB      │
                                                     │   (pgvector)     │
                                                     └──────────────────┘
```
1.  The API route calls the central `getPersona` provider.
2.  The provider calls the `hybridSearch` function in our `rag.ts` module.
3.  `hybridSearch` performs a combination of keyword and vector similarity searches against the Postgres database to find relevant context chunks.
4.  The retrieved context is passed back to the API route, injected into a prompt, and sent to the OpenAI Chat API. The response is streamed back to the user.

---

## 2. Runtime & Tech
*   **Framework**: Next.js 15 (App Router)
*   **UI**: React, Tailwind CSS
*   **Database**: Postgres with the `pgvector` extension.
*   **Vector Search**: Hybrid search (Keyword + Vector Similarity) implemented in `src/lib/rag.ts`.
*   **LLM**: OpenAI (`gpt-4o-mini`)
*   **Streaming**: Vercel AI SDK v3 (`@ai-sdk/react`, `@ai-sdk/openai`).
*   **Local Environment**: Docker Compose for the Postgres database.
*   **Hosting**: Vercel.

---

## 3. Key Modules

### 3.1 `src/lib/clients.ts`
*   Initializes and exports singleton clients for shared use across the application.
*   `db`: A `pg.Pool` instance for robust, pooled connections to the Postgres database. Essential for serverless environments.
*   `openai`: An OpenAI client instance.

### 3.2 `src/lib/rag.ts`
*   Contains the core `hybridSearch` function.
*   Connects to the database using the connection pool.
*   Takes a user query and `personaId` as input.
*   Generates an embedding for the user query.
*   Performs both a keyword (full-text) search and a vector similarity search against the database, filtered by `personaId`.
*   Merges and re-ranks the results using Reciprocal Rank Fusion (RRF) to provide the most relevant context chunks.

### 3.3 `src/lib/personaProvider.ts` (Refactored)
*   The central provider for persona data.
*   The `getPersona` function now takes a `userQuery` as input.
*   It first reads the base persona data (name, static context, etc.) from the local JSON files.
*   It then calls `hybridSearch` with the `userQuery` to get dynamic, relevant context from the database.
*   It combines the static file context and the dynamic RAG context before returning the complete `Persona` object.

### 3.4 API Routes (`/api/persona`, `/api/stress-test`)
*   All API routes that need persona information now call the refactored `getPersona` function, passing the user's query or idea.
*   This ensures all endpoints benefit from the new RAG pipeline.
*   `/api/persona` has been refactored to use the Vercel AI SDK to stream its response back to the client, preventing serverless timeouts.

---

## 4. Postgres Schema Reference

All indexed content is stored in a single table named `documents`.

| Column             | Type             | Description                                                                                                                              |
| ------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `id`               | `UUID`           | **Primary Key**. A unique, deterministically generated ID for each chunk.                                                                  |
| `content`          | `TEXT`           | The raw text content of the chunk.                                                                                                       |
| `embedding`        | `VECTOR(1536)`   | The 1536-dimension vector embedding of the `content`, generated by OpenAI. Indexed with HNSW for fast similarity search.                 |
| `metadata`         | `JSONB`          | A JSON object containing metadata about the chunk. Indexed with GIN for fast filtering. **Example:** `{ "source_file": "...", "persona_id": "..." }`. |
| `content_tsvector` | `TSVECTOR`       | A pre-computed vector of the `content` for fast full-text search. Indexed with GIN.                                                      |

---

*The remaining sections of the old architecture document (Data Contracts, Prompts, Scoring Model, etc.) are still largely relevant but should be reviewed in the context of the new RAG pipeline, which provides the context for these operations.*