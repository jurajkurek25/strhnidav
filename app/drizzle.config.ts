import type { Config } from "drizzle-kit";

// Only used for `drizzle-kit generate` when the schema changes in the
// future — the actual deploy path is running migrations/*.sql directly with
// psql, so this project doesn't depend on drizzle-kit at runtime.
export default {
  schema: "./src/lib/db/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
} satisfies Config;
