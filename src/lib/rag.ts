// src/lib/rag.ts
import { db } from './clients'; // Use the new connection pool
import { openai } from './clients';

const EMBEDDING_MODEL = 'text-embedding-3-small';

export interface SearchResult {
    id: string;
    content: string;
    metadata: {
        source_file: string;
        persona_id: string;
    };
    score: number;
}

/**
 * Performs a hybrid search (keyword + vector) on the database.
 */
export async function hybridSearch(
    query: string,
    personaId: string,
    topK = 5
): Promise<SearchResult[]> {
    const client = await db.connect(); // Check out a client from the pool

    try {
        // 1. Get embedding for the query
        const embeddingResponse = await openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: query,
        });
        const queryEmbedding = embeddingResponse.data[0].embedding;

        // 2. Perform keyword search (FTS)
        const keywordQuery = `
            SELECT id, content, metadata, ts_rank(content_tsvector, websearch_to_tsquery('english', $1)) AS score
            FROM documents
            WHERE metadata->>'persona_id' = $2
            AND content_tsvector @@ websearch_to_tsquery('english', $1)
            ORDER BY score DESC
            LIMIT $3;
        `;
        const keywordResults = await client.query(keywordQuery, [query, personaId, topK]);

        // 3. Perform vector search (HNSW)
        const vectorQuery = `
            SELECT id, content, metadata, 1 - (embedding <=> $1) AS score
            FROM documents
            WHERE metadata->>'persona_id' = $2
            ORDER BY score DESC
            LIMIT $3;
        `;
        const vectorResults = await client.query(vectorQuery, [`[${queryEmbedding.join(',')}]`, personaId, topK]);

        // 4. Combine and re-rank results (Reciprocal Rank Fusion)
        const rankedResults: Record<string, { score: number; result: SearchResult }> = {};

        const processResults = (results: any[], k = 60) => {
            results.forEach((row, index) => {
                const rank = index + 1;
                const score = 1 / (k + rank);
                if (!rankedResults[row.id] || score > rankedResults[row.id].score) {
                    rankedResults[row.id] = {
                        score,
                        result: {
                            id: row.id,
                            content: row.content,
                            metadata: row.metadata,
                            score: row.score, // original score for inspection
                        },
                    };
                }
            });
        };
        
        processResults(keywordResults.rows);
        processResults(vectorResults.rows);

        const finalResults = Object.values(rankedResults)
            .sort((a, b) => b.score - a.score)
            .map(item => item.result)
            .slice(0, topK);

        return finalResults;

    } catch (err) {
        console.error('Error during hybrid search:', err);
        return [];
    } finally {
        client.release(); // Release the client back to the pool
    }
}
