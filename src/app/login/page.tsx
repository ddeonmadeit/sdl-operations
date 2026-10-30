import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { LoginForm } from "./form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getUser();
  if (user) redirect(user.role === "supervisor" ? "/site" : "/office");
  const { next } = await searchParams;
  return (
    <main className="safe-top grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-accent text-xl font-bold text-white">SDL</div>
          <h1 className="text-2xl font-bold tracking-tight">SDL Creations</h1>
          <p className="mt-1 text-sm text-muted">Sign in to the office or site app</p>
        </div>
        <div className="card p-5">
          <LoginForm next={next} />
        </div>
      </div>
    </main>
  );
}
