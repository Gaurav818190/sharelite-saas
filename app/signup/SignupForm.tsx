"use client";
import { useState } from "react";
import Link from "next/link";
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

    const firstName = String(form.get("firstName") ?? "").trim();
    const lastName = String(form.get("lastName") ?? "").trim();
    const email = String(form.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(form.get("password") ?? "");

    if (!firstName) {
      setError("First name is required.");
      setPending(false);
      return;
    }

    if (!email) {
      setError("Email is required.");
      setPending(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setPending(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
        }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        const serverError = String(
          body?.error ?? "Unable to create account."
        );

        const lowerError = serverError.toLowerCase();

        if (
          lowerError.includes("already registered") ||
          lowerError.includes("already exists") ||
          lowerError.includes("user already")
        ) {
          setError(
            "An account with this email already exists. Please sign in."
          );
        } else {
          setError(serverError);
        }

        setPending(false);
        return;
      }

      if (body?.requiresEmailConfirmation) {
        setMessage("A 6-digit OTP has been sent to your email.");

        const verifyUrl = `/verify-email?email=${encodeURIComponent(email)}`;

        setTimeout(() => {
          router.push(verifyUrl);
        }, 700);

        return;
      }

      router.replace("/");
    } catch (error) {
      console.error("Signup form error:", error);
      setError("Something went wrong. Please try again.");
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#090d16] px-6 text-white">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8"
      >
        <h1 className="text-3xl font-black">
          Create your ShareLite account
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Start with your name and work email.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <label className="text-sm font-bold">
            First name
            <input
              name="firstName"
              required
              maxLength={100}
              autoComplete="given-name"
              className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#111827] px-4 outline-none focus:border-cyan-400"
            />
          </label>

          <label className="text-sm font-bold">
            Last name{" "}
            <span className="font-normal text-slate-500">optional</span>
            <input
              name="lastName"
              maxLength={100}
              autoComplete="family-name"
              className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#111827] px-4 outline-none focus:border-cyan-400"
            />
          </label>
        </div>

        <label className="mt-4 block text-sm font-bold">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#111827] px-4 outline-none focus:border-cyan-400"
          />
        </label>

        <label className="mt-4 block text-sm font-bold">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#111827] px-4 outline-none focus:border-cyan-400"
          />
        </label>

        {error && (
          <p role="alert" className="mt-4 text-sm text-rose-400">
            {error}
          </p>
        )}

        {message && (
          <p role="status" className="mt-4 text-sm text-emerald-400">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 h-12 w-full cursor-pointer rounded-xl bg-cyan-500 font-black text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Creating account…" : "Create account"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/login")}
          className="mt-4 w-full cursor-pointer text-sm text-cyan-400 hover:text-cyan-300"
        >
          Already have an account? Sign in
        </button>
      </form>
    </main>
  );
}