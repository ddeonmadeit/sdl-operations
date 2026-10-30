import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { getUser, isOffice } from "@/lib/auth";
import { completeXeroConnection } from "@/lib/xero";

export async function GET(req: Request) {
  const user = await getUser();
  if (!user || !isOffice(user)) return NextResponse.redirect(new URL("/login", req.url));
  const url = new URL(req.url);
  const jar = await cookies();
  const expected = jar.get("xero_state")?.value;
  jar.delete("xero_state");
  const back = (status: string) => NextResponse.redirect(new URL(`/office/settings?tab=xero&xero=${status}`, req.url));

  if (url.searchParams.get("error")) return back("denied");
  const code = url.searchParams.get("code");
  if (!code || !expected || url.searchParams.get("state") !== expected) return back("invalid");
  try {
    await completeXeroConnection(code);
    await logActivity({ userId: user.id, kind: "xero", message: "Xero connected" });
    return back("connected");
  } catch (err) {
    console.error(err);
    return back("error");
  }
}
