import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUser, isOffice, randomToken } from "@/lib/auth";
import { xeroAuthorizeUrl, xeroConfigured } from "@/lib/xero";

export async function GET(req: Request) {
  const user = await getUser();
  if (!user || !isOffice(user)) return NextResponse.redirect(new URL("/login", req.url));
  if (!xeroConfigured()) return NextResponse.redirect(new URL("/office/settings?tab=xero&xero=not-configured", req.url));
  const state = randomToken(16);
  (await cookies()).set("xero_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600, secure: process.env.NODE_ENV === "production" });
  return NextResponse.redirect(xeroAuthorizeUrl(state));
}
