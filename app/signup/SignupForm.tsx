"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupForm() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSubmitted(false);

    if (!firstName.trim()) {
      setError("Please enter your first name.");
      return;
    }

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to create your account.",
        );
      }

      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <section className="w-full max-w-[470px]">
        <div className="rounded-[30px] border border-white/70 bg-white p-6 shadow-[0_30px_90px_rgba(0,0,0,0.25)] sm:p-8">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-sm font-black tracking-[-0.08em] text-white">
              SL
            </div>

            <div className="mt-4 text-[27px] font-black tracking-[-0.055em] text-black">
              ShareLite
            </div>

            <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <svg
                viewBox="0 0 24 24"
                className="h-8 w-8"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m5 12 4 4L19 6" />
              </svg>
            </div>

            <h1 className="mt-5 text-2xl font-black text-slate-950">
              Check your email
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              We sent a confirmation email to{" "}
              <span className="font-bold text-slate-900">
                {email}
              </span>
              .
            </p>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              Open the email and click{" "}
              <span className="font-bold text-slate-900">
                Confirm your email
              </span>{" "}
              to continue setting up your ShareLite account.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              setError("");
            }}
            className="mt-7 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-900 transition hover:bg-slate-100"
          >
            Back to signup
          </button>
        </div>
      </section>
    );
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
            Start your AI-powered outreach journey.
          </p>
        </div>

        <div className="mt-7">
          <h1 className="text-[25px] font-black tracking-tight text-slate-950">
            Create your account
          </h1>

          <p className="mt-1.5 text-sm leading-6 text-slate-500">
            Start with a{" "}
            <span className="font-bold text-purple-700">
              12-day free trial
            </span>
            .
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-4"
          autoComplete="off"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="firstName"
                className="mb-2 block text-sm font-bold text-slate-800"
              >
                First name
              </label>

              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) =>
                  setFirstName(e.target.value)
                }
                placeholder="First name"
                autoComplete="given-name"
                required
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-purple-500 focus:bg-white focus:ring-4 focus:ring-purple-500/10"
              />
            </div>

            <div>
              <label
                htmlFor="lastName"
                className="mb-2 block text-sm font-bold text-slate-800"
              >
                Last name{" "}
                <span className="font-medium text-slate-400">
                  optional
                </span>
              </label>

              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) =>
                  setLastName(e.target.value)
                }
                placeholder="Last name"
                autoComplete="family-name"
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-purple-500 focus:bg-white focus:ring-4 focus:ring-purple-500/10"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-bold text-slate-800"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              placeholder="you@example.com"
              autoComplete="email"
              required
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-purple-500 focus:bg-white focus:ring-4 focus:ring-purple-500/10"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-bold text-slate-800"
            >
              Password
            </label>

            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
                required
                minLength={8}
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-20 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-purple-500 focus:bg-white focus:ring-4 focus:ring-purple-500/10"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword((current) => !current)
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-2 block text-sm font-bold text-slate-800"
            >
              Confirm password
            </label>

            <div className="relative">
              <input
                id="confirmPassword"
                type={
                  showConfirmPassword
                    ? "text"
                    : "password"
                }
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(e.target.value)
                }
                placeholder="Enter password again"
                autoComplete="new-password"
                required
                minLength={8}
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pr-20 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-purple-500 focus:bg-white focus:ring-4 focus:ring-purple-500/10"
              />

              <button
                type="button"
                onClick={() =>
                  setShowConfirmPassword(
                    (current) => !current,
                  )
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error && (
            <div
              className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-700"
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-13 w-full rounded-xl bg-black px-5 text-sm font-black text-white shadow-lg shadow-black/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Creating your account..."
              : "Start Your Free Trial"}
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

        <p className="mt-5 text-center text-xs leading-5 text-slate-400">
          By creating an account, you agree to ShareLite&apos;s
          terms and policies.
        </p>

        <div className="mt-5 border-t border-slate-100 pt-5 text-center">
          <span className="text-sm text-slate-500">
            Already have an account?
          </span>{" "}
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="text-sm font-black text-purple-700 transition hover:text-purple-500"
          >
            Sign in
          </button>
        </div>
      </div>
    </section>
  );
}