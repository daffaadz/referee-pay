import "dotenv/config";
import { db, pool } from "../src/db/index";
import { deals } from "../src/db/schema";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Testing connection to Neon Postgres...");
  console.log("Database URL Host:", new URL(process.env.DATABASE_URL || "").host);

  const result = await db.execute(sql`SELECT current_database(), current_user, version();`);
  console.log("Neon DB connected successfully:", result.rows[0]);

  const countRes = await db.select({ count: sql<number>`count(*)` }).from(deals);
  console.log("Deals table query succeeded. Total rows:", countRes[0]);

  await pool.end();
  console.log("Pool closed cleanly.");
}

main().catch((err) => {
  console.error("Neon test failed:", err);
  process.exit(1);
});

