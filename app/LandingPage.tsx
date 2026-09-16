"use client";

import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#080611] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,#5b21b6_0%,transparent_35%),radial-gradient(circle_at_bottom_left,#312e81_0%,transparent_35%)]" />

      <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="text-2xl font-black tracking-tight">
          Share<span className="text-purple-400">Lite</span>
        </Link>

        <Link
          href="/login"
          className="rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold backdrop-blur transition hover:bg-white/20"
        >
          Login
        </Link>
      </nav>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-100px)] w-full max-w-7xl items-center gap-14 px-6 py-12 lg:grid-cols-2 lg:px-10 lg:py-20">
        <div>
          <div className="mb-6 inline-flex rounded-full border border-purple-300/30 bg-purple-400/10 px-4 py-2 text-sm font-medium text-purple-200">
            AI-powered outreach made simple
          </div>

          <h1 className="max-w-3xl text-5xl font-black leading-tight tracking-tight sm:text-6xl lg:text-7xl">
            Reach more people.
            <span className="block bg-gradient-to-r from-purple-300 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent">
              Grow your business.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-white/65">
            Find leads, validate emails, create better outreach messages and
            manage your business growth from one powerful workspace.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/signup"
              className="rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500 px-7 py-4 text-base font-bold shadow-2xl shadow-purple-900/40 transition hover:scale-105 hover:from-purple-400 hover:to-fuchsia-400"
            >
              Get Started Free
            </Link>

            <span className="text-sm font-medium text-amber-200">
              5-day free trial
            </span>
          </div>

          <div className="mt-8 flex flex-wrap gap-5 text-sm text-white/55">
            <span>✓ Smart lead management</span>
            <span>✓ AI outreach suggestions</span>
            <span>✓ Email validation</span>
          </div>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute -inset-8 rounded-full bg-purple-600/20 blur-3xl" />

          <div className="relative rounded-[2rem] border border-white/15 bg-white/[0.08] p-4 shadow-2xl shadow-purple-950/50 backdrop-blur-xl">
            <div className="rounded-[1.5rem] border border-white/10 bg-[#111020] p-5">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/45">
                    ShareLite Workspace
                  </p>

                  <h2 className="mt-1 text-xl font-bold">
                    Outreach Overview
                  </h2>
                </div>

                <div className="rounded-xl bg-purple-500/20 px-3 py-2 text-xl">
                  ✦
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                  <p className="text-xs text-white/45">Total Leads</p>
                  <p className="mt-2 text-3xl font-black">1,248</p>
                  <p className="mt-1 text-xs text-emerald-300">+24.8%</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                  <p className="text-xs text-white/45">Valid Leads</p>
                  <p className="mt-2 text-3xl font-black">986</p>
                  <p className="mt-1 text-xs text-emerald-300">+18.2%</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-gradient-to-br from-purple-500/20 to-fuchsia-500/10 p-5">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">AI Message Assistant</p>
                  <span className="text-purple-200">✦</span>
                </div>

                <p className="mt-3 text-sm leading-6 text-white/60">
                  Create personalized outreach messages that sound natural,
                  professional and relevant to every lead.
                </p>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-purple-400 to-fuchsia-400" />
                </div>

                <p className="mt-2 text-xs text-white/45">
                  Outreach performance improving
                </p>
              </div>

              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-orange-500 text-xl">
                  🚀
                </div>

                <div>
                  <p className="font-semibold">Ready to grow?</p>
                  <p className="text-sm text-white/45">
                    Start your free trial today.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}