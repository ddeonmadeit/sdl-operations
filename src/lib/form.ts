import { toCents } from "./format";

/** Small helpers for reading FormData in server actions. */
export const str = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
};
export const optStr = (fd: FormData, key: string) => str(fd, key) || null;
export const int = (fd: FormData, key: string) => {
  const n = parseInt(str(fd, key), 10);
  return Number.isFinite(n) ? n : null;
};
export const num = (fd: FormData, key: string) => {
  const n = parseFloat(str(fd, key));
  return Number.isFinite(n) ? n : null;
};
export const cents = (fd: FormData, key: string) => toCents(str(fd, key));
export const optDate = (fd: FormData, key: string) => {
  const v = str(fd, key);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
};
export const bool = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
};

export type ActionState = { ok?: boolean; error?: string; message?: string } | null;
