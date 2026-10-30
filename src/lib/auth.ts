import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import type { Role } from "./constants";

export const SESSION_COOKIE = "sdl_session";
const SESSION_DAYS = 60;

export type SessionUser = Pick<User, "id" | "name" | "email" | "role" | "phone"> & { role: Role };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function randomToken(bytes = 24) {
  return randomBytes(bytes).toString("base64url");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: number) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  jar.delete(SESSION_COOKIE);
}

/** Current user (cached per request) or null. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      phone: users.phone,
      active: users.active,
      expiresAt: sessions.expiresAt,
      sessionId: sessions.id,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row || !row.active) return null;

  // Sliding expiry: extend sessions that are past half-life (cookie is refreshed on next login action).
  if (row.expiresAt.getTime() - Date.now() < (SESSION_DAYS / 2) * 86_400_000) {
    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000) })
      .where(eq(sessions.id, row.sessionId));
  }
  return { id: row.id, name: row.name, email: row.email, role: row.role as Role, phone: row.phone };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export const isOffice = (u: SessionUser) => u.role === "admin" || u.role === "office";

/** Office or admin only. Supervisors are sent to the site app. */
export async function requireOffice(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isOffice(user)) redirect("/site");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/office");
  return user;
}
