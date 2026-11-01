/* eslint-disable @next/next/no-img-element */
import { cx } from "./ui";

/** SDL Creations logo. "colour" for cream/light backgrounds, "cream" for dark olive backgrounds. */
export function Logo({ variant = "colour", className }: { variant?: "colour" | "cream"; className?: string }) {
  return (
    <img
      src={variant === "cream" ? "/brand/logo-full-cream.svg" : "/brand/logo-full.svg"}
      alt="SDL Creations"
      width={3168}
      height={1530}
      className={cx("h-auto select-none", className)}
      draggable={false}
    />
  );
}

/** The leaf mark on its own. */
export function LogoMark({ variant = "colour", className }: { variant?: "colour" | "cream" | "olive"; className?: string }) {
  const src = variant === "cream" ? "/brand/logo-mark-cream.svg" : variant === "olive" ? "/brand/logo-mark-olive.svg" : "/brand/logo-mark.svg";
  return <img src={src} alt="SDL Creations" width={2080} height={2480} className={cx("w-auto select-none", className)} draggable={false} />;
}
