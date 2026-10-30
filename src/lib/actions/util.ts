import "server-only";
import { revalidatePath } from "next/cache";

/** Revalidate everything – the app is small, and this keeps office + site views in sync. */
export function refresh() {
  revalidatePath("/", "layout");
}
