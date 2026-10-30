"use server";

import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";
import type { ActionState } from "@/lib/form";

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const password = String(fd.get("password") || "");
  if (!email || !password) return { error: "Enter your email and password." };
  const [user] = await db.select().from(users).where(eq(sql`lower(${users.email})`, email)).limit(1);
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "That email and password don't match." };
  }
  await createSession(user.id);
  const next = String(fd.get("next") || "");
  if (next.startsWith("/office") || next.startsWith("/site")) {
    redirect(user.role === "supervisor" && next.startsWith("/office") ? "/site" : next);
  }
  redirect(user.role === "supervisor" ? "/site" : "/office");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
