import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    // path: 'prisma/migrations', // If you have a migrations folder
    // seed: 'ts-node prisma/seed.ts', // If you have a seed script (we use dist/prisma/seed.js)
  },
  // This is where Prisma CLI will get the DATABASE_URL
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
