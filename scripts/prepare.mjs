/**
 * Runs during a hosted build (Vercel / Railway): set up the database, optionally load demo data.
 * Skips quietly if no database is connected yet, so the very first deploy still succeeds.
 */
import { execSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.warn("No DATABASE_URL yet – skipping database setup. Connect a database, then redeploy.");
  process.exit(0);
}
execSync("node scripts/migrate.mjs", { stdio: "inherit" });
if (process.env.LOAD_DEMO_DATA === "true") execSync("npx tsx scripts/seed.ts --demo", { stdio: "inherit" });
