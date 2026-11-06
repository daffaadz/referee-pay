import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const globalForDb = globalThis as unknown as { pool: pg.Pool };

function normalizeDatabaseUrl(rawUrl?: string): string {
  const url = rawUrl || "postgres://referee:referee@localhost:5432/referee";
  // Normalize sslmode to verify-full to eliminate pg-connection-string deprecation warning on Neon
  if (url.includes("sslmode=require") && !url.includes("uselibpqcompat")) {
    return url.replace("sslmode=require", "sslmode=verify-full");
  }
  if (url.includes("sslmode=prefer") && !url.includes("uselibpqcompat")) {
    return url.replace("sslmode=prefer", "sslmode=verify-full");
  }
  return url;
}

const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL);

export const pool =
  globalForDb.pool ||
  new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

pool.on("error", (err) => {
  console.warn("Neon pool idle client connection reset:", err.message);
});

if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool, { schema });

