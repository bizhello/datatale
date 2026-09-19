import { defineConfig } from "drizzle-kit";
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/shared/lib/db/schema.ts",
  out: "./migrations",
});
