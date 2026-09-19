import "server-only";
import { neon } from "@neondatabase/serverless";

export function getDatabase() {
  const url = process.env.DATABASE_URL;
  return url ? neon(url) : undefined;
}
