import { NextResponse } from "next/server";
import { db } from "@/db";
import { files } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { newStorageKey, putFile } from "@/lib/storage";

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return new NextResponse("Not signed in", { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return new NextResponse("No file", { status: 400 });
  if (file.size > MAX_BYTES) return new NextResponse("File is too large (25MB max)", { status: 413 });

  const jobId = Number(form.get("jobId")) || null;
  const category = String(form.get("category") || "document");
  const key = newStorageKey(file.name);
  const mimeType = file.type || "application/octet-stream";
  await putFile(key, Buffer.from(await file.arrayBuffer()), mimeType);

  const [row] = await db
    .insert(files)
    .values({ jobId, ownerType: "pending", category, name: file.name, mimeType, size: file.size, storageKey: key, uploadedById: user.id })
    .returning({ id: files.id });
  return NextResponse.json({ id: row!.id });
}
