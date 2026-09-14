"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthProviderButtons } from "@/app/AuthProviderButtons";

export function LoginForm() {
  const router = useRouter();
  const [oauthError, setOauthError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setOauthError(false);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    if (response.ok) {
      router.replace("/");
      return;
    }
    const body = await response.json().catch(() => null);
    setError(body?.error ?? "Unable to sign in.");
    setPending(false);
  }

  return (
    <main className="min-h-screen bg-[#090d16] text-white flex items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <h1 className="text-3xl font-black">Sign in to ShareLite</h1>
        <p className="mt-2 text-sm text-slate-400">Use your email and password to continue.</p>
        {oauthError && <p role="alert" className="mt-4 text-sm text-rose-400">Social sign-in could not be completed. Try again or use email.</p>}
        <label className="mt-8 block text-sm font-bold">Email<input name="email" type="email" required autoComplete="email" className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#111827] px-4" /></label>
        <label className="mt-4 block text-sm font-bold">Password<input name="password" type="password" required minLength={8} autoComplete="current-password" className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#111827] px-4" /></label>
        {error && <p role="alert" className="mt-4 text-sm text-rose-400">{error}</p>}
        <button disabled={pending} className="mt-6 h-12 w-full rounded-xl bg-cyan-500 font-black disabled:opacity-60">{pending ? "Signing in…" : "Sign In"}</button>
        <button type="button" onClick={() => router.push("/signup")} className="mt-4 w-full text-sm text-cyan-400">Create an account</button>
      </form>
    </main>
  );
}
