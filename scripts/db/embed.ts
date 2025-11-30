// scripts/db/embed.ts
import { Client } from 'pg';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { v5 as uuidv5 } from 'uuid';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

// --- CONFIGURATION ---
const GLOBAL_KNOWLEDGE_DIR = path.join(process.cwd(), 'data', 'global-knowledge');
const PERSONAS_DIR = path.join(process.cwd(), 'data', 'personas');
const EMBEDDING_MODEL = 'text-embedding-3-small';
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;
const UUID_NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341'; // DO NOT CHANGE

// --- VALIDATE ENVIRONMENT VARIABLES ---
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

function generateUUID(value: string): string {
  return uuidv5(value, UUID_NAMESPACE);
}

async function findAllFiles(startPath: string): Promise<string[]> {
    try {
        const entries = await fs.readdir(startPath, { withFileTypes: true });
        const files = await Promise.all(
            entries.map((entry) => {
                const fullPath = path.join(startPath, entry.name);
                if (entry.isDirectory()) {
                    return findAllFiles(fullPath);
                } else {
                    return [fullPath];
                }
            })
        );
        return files.flat();
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.warn(`Directory not found, skipping: ${startPath}`);
            return [];
        }
        throw error;
    }
}


function chunkText(text: string): string[] {
    if (!text) return [];
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
        chunks.push(text.slice(i, i + CHUNK_SIZE));
    }
    return chunks;
}

async function getTextFromFile(filePath: string): Promise<string> {
    const extension = path.extname(filePath).toLowerCase();
    const fileContent = await fs.readFile(filePath);

    if (extension === '.json') {
        const data = JSON.parse(fileContent.toString('utf-8'));
        return getTextFromPersona(data);
    } else if (extension === '.pdf') {
        const data = await pdf(fileContent);
        return data.text;
    } else if (extension === '.docx') {
        const data = await mammoth.extractRawText({ buffer: fileContent });
        return data.value;
    } else {
        return fileContent.toString('utf-8');
    }
}


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

async function embedAllData() {
    await pgClient.connect();
    console.log('🚀 Starting data embedding process...');

    const processedDocIds = new Set<string>();

    const embedFile = async (filePath: string, personaIds: string[]) => {
        try {
            const textToEmbed = await getTextFromFile(filePath);
            const chunks = chunkText(textToEmbed);

            const metadata = {
                source_file: path.relative(process.cwd(), filePath),
                persona_ids: personaIds,
            };

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const uniqueChunkIdentifier = `${metadata.source_file}::${personaIds.join('-')}::chunk${i}`;
                const docId = generateUUID(uniqueChunkIdentifier);
                processedDocIds.add(docId);

                const embeddingResponse = await openai.embeddings.create({
                    model: EMBEDDING_MODEL,
                    input: chunk,
                });
                const embedding = embeddingResponse.data[0].embedding;

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
        } catch (error) {
            console.error(`Error processing file ${filePath}:`, error);
        }
    };

    try {
        // 1. Process Global Knowledge
        console.log('\n--- Processing Global Knowledge ---');
        const globalFiles = await findAllFiles(GLOBAL_KNOWLEDGE_DIR);
        console.log(`Found ${globalFiles.length} global knowledge files.`);
        for (const filePath of globalFiles) {
            await embedFile(filePath, ['*']);
        }

        // 2. Process Persona-Specific Knowledge
        console.log('\n--- Processing Persona-Specific Knowledge ---');
        const personaDirs = await fs.readdir(PERSONAS_DIR, { withFileTypes: true });

        for (const dir of personaDirs) {
            if (dir.isDirectory()) {
                const personaId = dir.name;
                const personaDirPath = path.join(PERSONAS_DIR, personaId);
                console.log(`\nProcessing persona: ${personaId}`);

                // Embed persona.json
                const personaJsonPath = path.join(personaDirPath, 'persona.json');
                if (await fs.stat(personaJsonPath).catch(() => false)) {
                    await embedFile(personaJsonPath, [personaId]);
                }

                // Embed files in knowledge/ directory
                const knowledgePath = path.join(personaDirPath, 'knowledge');
                const knowledgeFiles = await findAllFiles(knowledgePath);
                console.log(` Found ${knowledgeFiles.length} knowledge files for ${personaId}.`);
                for (const filePath of knowledgeFiles) {
                    await embedFile(filePath, [personaId]);
                }
            }
        }


        // 3. Cleanup stale documents
        const allDbIdsResult = await pgClient.query('SELECT id FROM documents');
        const allDbIds = new Set(allDbIdsResult.rows.map(r => r.id));

        const staleIds = [...allDbIds].filter(id => !processedDocIds.has(id));

        if (staleIds.length > 0) {
            await pgClient.query('DELETE FROM documents WHERE id = ANY($1::UUID[])', [staleIds]);
            console.log(`\n🧹 Cleaned up ${staleIds.length} stale documents.`);
        } else {
            console.log('\n✨ No stale documents to clean up.');
        }

        console.log('\n✅ Data embedding process complete! 🎉');

    } catch (err) {
        console.error('❌ Error during embedding process:', err);
    } finally {
        await pgClient.end();
    }
}

embedAllData();
