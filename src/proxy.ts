import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "sdl_session";

/** Fast cookie check: send signed-out users to /login, and keep the session cookie fresh. */
export function proxy(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 86400,
  });
  return res;
}

export const config = { matcher: ["/office/:path*", "/site/:path*"] };
