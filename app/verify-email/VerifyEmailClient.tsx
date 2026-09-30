"use client";

import Link from "next/link";

export default function VerifyEmailClient() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-2xl">
          ✉️
        </div>

        <h1 className="text-2xl font-semibold text-white">
          Check your email
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-300">
          We sent you a confirmation email. Open it and click
          <span className="font-medium text-white">
            {" Confirm your email "}
          </span>
          to continue setting up your ShareLite account.
        </p>

        <Link
          href="/login"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
        >
          Go to login
        </Link>
      </section>
    </main>
  );
}