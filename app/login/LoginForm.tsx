"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [oauthError, setOauthError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const callbackError = searchParams.get("error");

    if (callbackError === "verification_failed") {
      setError(
        "Email verification failed or the verification link has expired. Please try signing up again.",
      );
    }

    if (searchParams.get("oauth_error") === "1") {
      setOauthError(true);
    }
  }, [searchParams]);

  async function submit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(null);
    setOauthError(false);
    setPending(true);

    try {
      const form = new FormData(event.currentTarget);

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setError(body?.error ?? "Unable to sign in.");
        setPending(false);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Authentication service is unavailable.");
      setPending(false);
    }
  }

  return (
    <section className="w-full max-w-[470px]">
      <div className="rounded-[30px] border border-white/70 bg-white p-6 shadow-[0_30px_90px_rgba(0,0,0,0.25)] sm:p-8">
        {/* Brand */}
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-sm font-black tracking-[-0.08em] text-white">
            SL
          </div>

          <div className="mt-4 text-[27px] font-black tracking-[-0.055em] text-black">
            ShareLite
          </div>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            AI-powered outreach made simple.
          </p>
        </div>

        <div className="mt-7">
          <h1 className="text-[25px] font-black tracking-tight text-slate-950">
            Welcome back
          </h1>

          <p className="mt-1.5 text-sm leading-6 text-slate-500">
            Sign in to continue your outreach journey.
          </p>
        </div>

        {/* OAuth error */}
        {oauthError && (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-800"
          >
            Social sign-in could not be completed. Try again or use
            email and password.
          </div>
        )}

        <form onSubmit={submit} className="mt-6">
          <label className="block text-sm font-bold text-slate-800">
            Email

            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-purple-500 focus:bg-white focus:ring-4 focus:ring-purple-500/10"
            />
          </label>

          <label className="mt-4 block text-sm font-bold text-slate-800">
            Password

            <div className="relative mt-2">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete="current-password"
                placeholder="Enter your password"
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-20 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-purple-500 focus:bg-white focus:ring-4 focus:ring-purple-500/10"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword((current) => !current)
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-700"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-6 h-13 w-full rounded-xl bg-black px-5 text-sm font-black text-white shadow-lg shadow-black/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending
              ? "Signing you in..."
              : "Continue Your Journey"}
          </button>
        </form>

        {/* Trust badges */}
        <div className="mt-7 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-2 py-3 text-center">
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 3 5 6v5c0 4.5 2.9 8.3 7 10 4.1-1.7 7-5.5 7-10V6l-7-3Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>

            <div className="mt-2 text-[11px] font-black text-slate-800">
              Protected
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-2 py-3 text-center">
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 21s8-4.4 8-10V5l-8-3-8 3v6c0 5.6 8 10 8 10Z" />
                <path d="M9.5 12.5 11 14l3.5-4" />
              </svg>
            </div>

            <div className="mt-2 text-[11px] font-black text-slate-800">
              Private
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-2 py-3 text-center">
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>

            <div className="mt-2 text-[11px] font-black text-slate-800">
              AI-Powered
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-5 text-center">
          <span className="text-sm text-slate-500">
            New to ShareLite?
          </span>{" "}
          <button
            type="button"
            onClick={() => router.push("/signup")}
            className="text-sm font-black text-purple-700 transition hover:text-purple-500"
          >
            Create your account
          </button>
        </div>
      </div>
    </section>
  );
}