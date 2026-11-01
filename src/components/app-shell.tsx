"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** When the app comes back to the foreground after a while, pull fresh data (e.g. the office booked KPR meanwhile). */
export function RefreshOnReturn({ afterSeconds = 30 }: { afterSeconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    let hiddenAt = 0;
    const onChange = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > afterSeconds * 1000) router.refresh();
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [router, afterSeconds]);
  return null;
}
