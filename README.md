This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

This guide provides the minimal commands to get the project running locally. For a complete "zero-to-hero" setup guide, which includes configuring environment variables, please see **[our full Contributing Guide](./docs/CONTRIBUTING.md)**.

**Prerequisites:**
- Node.js, npm, and Docker Desktop are installed.
- You have created and configured your `.env.local` file as described in the contributing guide.

### Quick Start

1.  **Start the local database:**
    ```bash
    docker-compose up -d
    ```

2.  **Set up the database schema and ingest data:**
    ```bash
    npm run db:setup && npm run embed
    ```

3.  **Run the development server:**
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
