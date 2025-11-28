// src/lib/clients.ts
import { Pool } from 'pg';
import OpenAI from 'openai';

// --- VALIDATE ENVIRONMENT VARIABLES ---
if (!process.env.STORAGE_URL && !process.env.POSTGRES_URL_LOCAL) {
    throw new Error('Database connection string is not set in environment variables (expected STORAGE_URL or POSTGRES_URL_LOCAL).');
}
if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in environment variables.');
}

// --- CLIENTS ---

let pgPoolInstance: Pool | null = null;
let openaiInstance: OpenAI | null = null;

const getPgPool = () => {
    if (!pgPoolInstance) {
        const connectionString = process.env.NODE_ENV === 'production' 
            ? process.env.STORAGE_URL 
            : process.env.POSTGRES_URL_LOCAL;
        
        pgPoolInstance = new Pool({
            connectionString,
            // Recommended settings for serverless environments
            max: 1, 
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
    }
    return pgPoolInstance;
};

const getOpenAIClient = () => {
    if (!openaiInstance) {
        openaiInstance = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return openaiInstance;
};

export const db = getPgPool();
export const openai = getOpenAIClient();
