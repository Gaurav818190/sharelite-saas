"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.error ?? "Unable to create account.");
      setPending(false);
      return;
    }
    if (body?.requiresEmailConfirmation) {
      setMessage("Account created. Check your email to confirm your account, then sign in.");
      setPending(false);
      return;
    }
    router.replace("/");
  }

  return (
    <main className="min-h-screen bg-[#090d16] text-white flex items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <h1 className="text-3xl font-black">Create your ShareLite account</h1>
        <label className="mt-8 block text-sm font-bold">Email<input name="email" type="email" required autoComplete="email" className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#111827] px-4" /></label>
        <label className="mt-4 block text-sm font-bold">Password<input name="password" type="password" required minLength={8} autoComplete="new-password" className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#111827] px-4" /></label>
        {error && <p role="alert" className="mt-4 text-sm text-rose-400">{error}</p>}
        {message && <p role="status" className="mt-4 text-sm text-emerald-400">{message}</p>}
        <button disabled={pending} className="mt-6 h-12 w-full rounded-xl bg-cyan-500 font-black disabled:opacity-60">{pending ? "Creating account…" : "Create account"}</button>
        <button type="button" onClick={() => router.push("/login")} className="mt-4 w-full text-sm text-cyan-400">Already have an account? Sign in</button>
      </form>
    </main>
  );
}
