// scripts/db/embed.ts
import { Client } from 'pg';
// import dotenv from 'dotenv';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path'; // Keep path as it's used elsewhere
import { v5 as uuidv5 } from 'uuid';

// Load environment variables from .env file
// dotenv.config({ path: path.resolve(process.cwd(), '.env') });


// --- CONFIGURATION ---
const isProduction = process.env.NODE_ENV === 'production';
const PERSONAS_DIR = path.join(process.cwd(), 'data', 'personas');
const EMBEDDING_MODEL = 'text-embedding-3-small';
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;
const UUID_NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341'; // DO NOT CHANGE

// --- VALIDATE ENVIRONMENT VARIABLES ---
// Prioritize the production one if available.
const connectionString = process.env.POSTGRES_URL || process.env.POSTGRES_URL_LOCAL;
if (!connectionString) {
  throw new Error('Database connection string is not set. Please check your .env file.');
}
if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set. Please check your .env file.');
}


// --- CLIENTS ---
const pgClient = new Client({ connectionString });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- HELPER FUNCTIONS ---

/**
 * Generates a deterministic UUID v5.
 */
function generateUUID(value: string): string {
  return uuidv5(value, UUID_NAMESPACE);
}

/**
 * Recursively finds all files with a given extension in a directory.
 */
async function findFilesByExt(startPath: string, ext: string): Promise<string[]> {
  const entries = await fs.readdir(startPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const fullPath = path.join(startPath, entry.name);
      if (entry.isDirectory()) {
        return findFilesByExt(fullPath, ext);
      } else if (path.extname(fullPath) === ext) {
        return [fullPath];
      }
      return [];
    })
  );
  return files.flat();
}

/**
 * Splits text into overlapping chunks.
 */
function chunkText(text: string): string[] {
    if (!text) return [];
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
        chunks.push(text.slice(i, i + CHUNK_SIZE));
    }
    return chunks;
}

/**
 * Extracts a string representation from persona JSON data.
 * This function needs to be robust to different JSON structures.
 */
function getTextFromPersona(data: any): string {
    return Object.entries(data)
        .map(([key, value]) => {
            if (typeof value === 'string') {
                return value;
            }
            if (typeof value === 'object' && value !== null) {
                return getTextFromPersona(value);
            }
            return '';
        })
        .join(' ');
}


// --- MAIN LOGIC ---

async function embedPersonas() {
  await pgClient.connect();
  console.log('🚀 Starting persona embedding process...');

  try {
    const personaFiles = await findFilesByExt(PERSONAS_DIR, '.json');
    console.log(`Found ${personaFiles.length} persona files to process.`);

    const processedDocIds = new Set<string>();

    for (const filePath of personaFiles) {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const personaData = JSON.parse(fileContent);

      const textToEmbed = getTextFromPersona(personaData);
      const chunks = chunkText(textToEmbed);

      const metadata = {
        source_file: path.relative(process.cwd(), filePath),
        persona_id: path.basename(filePath, '.json'),
      };

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const uniqueChunkIdentifier = `${metadata.source_file}::chunk${i}`;
        const docId = generateUUID(uniqueChunkIdentifier);
        processedDocIds.add(docId);

        // 1. Get embedding
        const embeddingResponse = await openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: chunk,
        });
        const embedding = embeddingResponse.data[0].embedding;

        // 2. Upsert into database
        const upsertQuery = `
          INSERT INTO documents (id, content, embedding, metadata)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (id) DO UPDATE SET
            content = EXCLUDED.content,
            embedding = EXCLUDED.embedding,
            metadata = EXCLUDED.metadata;
        `;
        await pgClient.query(upsertQuery, [docId, chunk, `[${embedding.join(',')}]`, metadata]);
        console.log(` Upserted chunk ${i + 1}/${chunks.length} from ${metadata.source_file}`);
      }
    }

    // 3. Cleanup stale documents
    const allDbIdsResult = await pgClient.query('SELECT id FROM documents');
    const allDbIds = new Set(allDbIdsResult.rows.map(r => r.id));

    const staleIds = [...allDbIds].filter(id => !processedDocIds.has(id));

    if (staleIds.length > 0) {
      await pgClient.query('DELETE FROM documents WHERE id = ANY($1::UUID[])', [staleIds]);
      console.log(`🧹 Cleaned up ${staleIds.length} stale documents.`);
    } else {
      console.log('✨ No stale documents to clean up.');
    }

    console.log('\n✅ Persona embedding process complete! 🎉');

  } catch (err) {
    console.error('❌ Error during embedding process:', err);
  } finally {
    await pgClient.end();
  }
}

embedPersonas();
