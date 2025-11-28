// scripts/db/schema.ts
import { Client } from 'pg';
// import dotenv from 'dotenv';
// import path from 'path';

// Load environment variables from .env file

// dotenv.config({ path: path.resolve(process.cwd(), '.env') });



// Determine which connection string to use. Prioritize the production one if available.



const connectionString = process.env.POSTGRES_URL || process.env.POSTGRES_URL_LOCAL;

if (!connectionString) {
  throw new Error('Database connection string is not set. Please check your .env file.');
}

// Configure the database client
const client = new Client({ connectionString });

async function setupDatabase() {
  await client.connect();

  try {
    // 1. Create the vector extension
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('✅ "vector" extension created or already exists.');

    // 2. Drop existing table for a clean slate (optional, good for dev)
    await client.query('DROP TABLE IF EXISTS documents;');
    console.log('✅ "documents" table dropped.');

    // 3. Create the documents table
    // OpenAI's text-embedding-ada-002 model produces 1536-dimensional vectors
    const createTableQuery = `
      CREATE TABLE documents (
        id UUID PRIMARY KEY,
        content TEXT NOT NULL,
        embedding VECTOR(1536) NOT NULL,
        metadata JSONB,
        content_tsvector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
      );
    `;
    await client.query(createTableQuery);
    console.log('✅ "documents" table created successfully.');
    console.log('   - id: UUID (Primary Key)');
    console.log('   - content: TEXT');
    console.log('   - embedding: VECTOR(1536)');
    console.log('   - metadata: JSONB');
    console.log('   - content_tsvector: TSVECTOR (for Full-Text Search)');


    // 4. Create indexes for efficient querying
    await client.query(`
      CREATE INDEX ON documents USING GIN (metadata);
    `);
    console.log('✅ GIN index on "metadata" created.');

    await client.query(`
      CREATE INDEX ON documents USING GIN (content_tsvector);
    `);
    console.log('✅ GIN index on "content_tsvector" created.');

    await client.query(`
      CREATE INDEX ON documents USING HNSW (embedding vector_l2_ops);
    `);
    console.log('✅ HNSW index on "embedding" created for fast vector similarity search.');

    console.log('\nDatabase setup complete! 🎉');

  } catch (err) {
    console.error('❌ Error during database setup:', err);
  } finally {
    await client.end();
  }
}

setupDatabase();
