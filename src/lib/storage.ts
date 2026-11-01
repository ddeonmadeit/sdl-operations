import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { AwsClient } from "aws4fetch";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { blobs } from "@/db/schema";
import { randomToken } from "./auth";

/**
 * File storage. Uses an S3-compatible bucket when S3_BUCKET is set,
 * the database when FILE_STORAGE=database or on Vercel/Railway/Render without a disk,
 * otherwise the local ./uploads folder (or UPLOAD_DIR).
 */
const onDisklessHost = Boolean(process.env.VERCEL || process.env.RAILWAY_ENVIRONMENT || process.env.RENDER) && !process.env.UPLOAD_DIR;
const inDb = !process.env.S3_BUCKET && (process.env.FILE_STORAGE === "database" || onDisklessHost);
const s3 = process.env.S3_BUCKET
  ? {
      client: new AwsClient({
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
        region: process.env.S3_REGION || "auto",
        service: "s3",
      }),
      base: `${(process.env.S3_ENDPOINT || "").replace(/\/$/, "")}/${process.env.S3_BUCKET}`,
    }
  : null;

// Upload folder is chosen at runtime, so tell the bundler not to trace it.
const localDir = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || "uploads");

export function newStorageKey(filename: string) {
  const ext = path.extname(filename).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 8);
  const d = new Date();
  return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${randomToken(12)}${ext}`;
}

export async function putFile(key: string, data: Buffer, contentType: string) {
  if (s3) {
    const res = await s3.client.fetch(`${s3.base}/${key}`, {
      method: "PUT",
      body: new Uint8Array(data),
      headers: { "content-type": contentType },
    });
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
    return;
  }
  if (inDb) {
    await db.insert(blobs).values({ key, data });
    return;
  }
  const full = path.join(/*turbopackIgnore: true*/ localDir, key);
  await mkdir(/*turbopackIgnore: true*/ path.dirname(full), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ full, data);
}

export async function getFile(key: string): Promise<Buffer | null> {
  if (s3) {
    const res = await s3.client.fetch(`${s3.base}/${key}`);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }
  if (inDb) {
    const [row] = await db.select().from(blobs).where(eq(blobs.key, key));
    return row?.data ?? null;
  }
  try {
    const full = path.join(/*turbopackIgnore: true*/ localDir, key);
    if (!full.startsWith(localDir)) return null;
    return await readFile(/*turbopackIgnore: true*/ full);
  } catch {
    return null;
  }
}

export async function deleteFile(key: string) {
  if (s3) {
    await s3.client.fetch(`${s3.base}/${key}`, { method: "DELETE" });
    return;
  }
  if (inDb) {
    await db.delete(blobs).where(eq(blobs.key, key));
    return;
  }
  try {
    await unlink(path.join(/*turbopackIgnore: true*/ localDir, key));
  } catch {}
}
