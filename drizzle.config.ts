import { defineConfig } from 'drizzle-kit';
import path from 'path';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: path.join(process.cwd(), 'data', 'db.sqlite'),
  },
});
