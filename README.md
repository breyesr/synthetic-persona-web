This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

This project uses a local Postgres database with `pgvector` for its retrieval-augmented generation (RAG) capabilities.

### 1. Environment Setup

This project requires a local environment file to store your API keys and database connection string.

First, copy the example file to create your own local configuration:
```bash
cp .env.example .env.local
```

Next, edit the new `.env.local` file:
- Add your `OPENAI_API_KEY`.
- The `POSTGRES_URL_LOCAL` is already configured for the Docker setup on port `5433`. Ensure this line is present and correct.
- **Important:** Ensure each variable is on a single line and there are no extra characters.

### 2. Running the Local Database

You must have Docker Desktop running on your machine.

To start the local Postgres database with the `pgvector` extension, run the following command. This will download the database image and start the container.
```bash
docker-compose up -d
```
This will start a database server accessible on your machine at port `5433`.

### 3. Database Schema Setup

Once the database container is running, you need to create the necessary tables and indexes. Run the setup script:
```bash
npm run db:setup
```

### 4. Data Ingestion

Next, you need to process the persona documents in the `/data` directory and load them into the database. This script generates vector embeddings for the content and must be run for the RAG system to work.

Run the ingestion script:
```bash
npm run embed
```
**Note:** You only need to run this script once. If you add or modify the JSON files in the `/data` directory in the future, you must run this script again to update the database.

### 5. Running the Development Server

Finally, you can run the Next.js development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or the port Next.js selects if 3000 is busy) with your browser to see the result.


## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
