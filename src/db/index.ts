import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const globalForDb = globalThis as unknown as { pool: pg.Pool };

const connectionString =
  process.env.DATABASE_URL ||
  "postgres://referee:referee@localhost:5432/referee";

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

