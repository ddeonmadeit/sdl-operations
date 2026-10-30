/**
 * Runs database migrations, then makes sure the first admin login and the KPR contact exist.
 * Runs automatically on `npm run start:prod` (and in Docker). Safe to run any number of times.
 */
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

try {
  (await import("dotenv")).config();
} catch {}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log("Database is up to date.");

  const { rows } = await pool.query("select count(*)::int as n from users");
  if (rows[0].n === 0) {
    const email = (process.env.ADMIN_EMAIL || "").toLowerCase();
    const password = process.env.ADMIN_PASSWORD || "";
    if (email && password.length >= 8) {
      await pool.query("insert into users (name, email, role, password_hash) values ($1, $2, 'admin', $3)", [
        process.env.ADMIN_NAME || "SDL Admin",
        email,
        await bcrypt.hash(password, 10),
      ]);
      console.log(`Created admin login: ${email}`);
    } else {
      console.warn("No users yet – set ADMIN_EMAIL and ADMIN_PASSWORD (8+ characters) to create the first admin login.");
    }
  }
  const kpr = await pool.query("select 1 from contacts where type = 'labour_hire' limit 1");
  if (!kpr.rowCount) {
    await pool.query("insert into contacts (type, name, notes) values ('labour_hire', 'KPR Labour Hire', 'All SDL labour hire is booked through the office.')");
    console.log("Added KPR Labour Hire contact – add their email in Contacts.");
  }
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
