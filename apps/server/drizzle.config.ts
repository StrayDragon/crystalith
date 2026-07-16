import { defineConfig } from 'drizzle-kit';

const dataRoot = process.env.CL_DATA_ROOT ?? 'data';
const dbUrl = process.env.CL_DB_PATH ?? `${dataRoot}/crystalith.db`;

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: dbUrl,
  },
  verbose: true,
  strict: true,
});
