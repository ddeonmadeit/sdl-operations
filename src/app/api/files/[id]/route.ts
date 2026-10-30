import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { files } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { getFile } from "@/lib/storage";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return new NextResponse("Not signed in", { status: 401 });
  const { id } = await params;
  const [row] = await db.select().from(files).where(eq(files.id, Number(id))).limit(1);
  if (!row) return new NextResponse("Not found", { status: 404 });
  const data = await getFile(row.storageKey);
  if (!data) return new NextResponse("Not found", { status: 404 });
  const download = new URL(req.url).searchParams.has("download");
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "content-type": row.mimeType,
      "content-length": String(data.length),
      "cache-control": "private, max-age=31536000, immutable",
      "content-disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(row.name)}"`,
    },
  });
}
