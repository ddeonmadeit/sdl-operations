import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { Logo } from "@/components/brand";
import { LoginForm } from "./form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getUser();
  if (user) redirect(user.role === "supervisor" ? "/site" : "/office");
  const { next } = await searchParams;
  return (
    <main className="safe-top grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <h1 className="sr-only">SDL Creations</h1>
          <Logo className="w-52" />
          <p className="mt-5 text-sm text-muted">Sign in to the office or site app</p>
        </div>
        <div className="card p-5">
          <LoginForm next={next} />
        </div>
      </div>
    </main>
  );
}
