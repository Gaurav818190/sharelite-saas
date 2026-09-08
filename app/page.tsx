"use client";

import { useState } from "react";

export default function Home() {
  const [showPassword, setShowPassword] = useState(false);
  const [dark, setDark] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "campaigns", label: "Campaigns", icon: "🚀" },
    { id: "leads", label: "Leads", icon: "👥" },
    { id: "templates", label: "Templates", icon: "📝" },
    { id: "analytics", label: "Analytics", icon: "📈" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  const stats = [
    { label: "Total Leads", value: "1,248", change: "+12% from last 7 days" },
    { label: "Valid Leads", value: "1,132", change: "+10% from last 7 days" },
    { label: "Contacted", value: "486", change: "+18% from last 7 days" },
    { label: "Converted", value: "78", change: "+22% from last 7 days" },
  ];

  if (isLoggedIn) {
    return (
      <main
        className={`min-h-screen flex ${
          dark
            ? "bg-[#070a12] text-slate-100"
            : "bg-[#f8fafc] text-slate-900"
        }`}
      >
        <aside
          className={`w-72 border-r flex flex-col justify-between p-6 transition-colors duration-300 ${
            dark
              ? "border-white/[0.08] bg-[#0b0f19]"
              : "border-slate-200 bg-white"
          }`}
        >
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 via-indigo-600 to-amber-500 text-white shadow-lg shadow-purple-500/25 font-bold text-lg">
                👑
              </div>
              <div>
                <div className="text-base font-black tracking-tight">ShareLite</div>
                <div
                  className={`text-[10px] font-semibold uppercase tracking-wider ${
                    dark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Outreach Platform
                </div>
              </div>
            </div>

            <nav className="space-y-1.5">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === item.id
                      ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-cyan-500/20"
                      : dark
                        ? "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span className="text-sm">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div
            className={`p-4 rounded-2xl border bg-gradient-to-b relative overflow-hidden ${
              dark
                ? "from-purple-950/40 via-[#0d0915] to-[#0b0f19] border-purple-500/30"
                : "from-purple-50 via-amber-50/30 to-white border-purple-200"
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-amber-400 text-base">👑</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                Upgrade to Pro
              </span>
            </div>
            <p
              className={`text-[11px] leading-relaxed mb-3 ${
                dark ? "text-slate-300" : "text-slate-600"
              }`}
            >
              Unlock advanced features, more leads & higher limits.
            </p>
            <button className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-amber-500 text-white text-xs font-black shadow-lg shadow-purple-500/25 hover:opacity-95 transition">
              Upgrade Now
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">
          <header
            className={`h-[72px] border-b px-8 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md ${
              dark
                ? "border-white/[0.08] bg-[#070a12]/80"
                : "border-slate-200 bg-white/80"
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold ${
                  dark
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Live · 12:34:56 PM
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setDark(!dark)}
                className={`p-2.5 rounded-xl border transition ${
                  dark
                    ? "border-white/10 bg-white/5 text-amber-400 hover:bg-white/10"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {dark ? "☀ Light Mode" : "☾ Dark Mode"}
              </button>

              <div className="flex items-center gap-2.5 pl-2 border-l border-white/10">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center font-bold text-white text-xs shadow">
                  G
                </div>
                <div className="text-xs font-bold">Gaurav</div>
                <button
                  onClick={() => setIsLoggedIn(false)}
                  className="ml-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition"
                >
                  Logout
                </button>
              </div>
            </div>
          </header>

          <div className="p-8 max-w-7xl w-full mx-auto space-y-8">
            {activeTab === "dashboard" && (
              <>
                <div>
                  <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                    Good Morning, Gaurav <span className="text-amber-400">👑</span>
                  </h1>
                  <p
                    className={`text-xs mt-1 ${
                      dark ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    Here is what is happening in your outreach journey today.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {stats.map((stat) => (
                    <div
                      key={stat.label}
                      className={`p-5 rounded-2xl border transition-all ${
                        dark
                          ? "border-white/[0.08] bg-white/[0.02]"
                          : "border-slate-200 bg-white shadow-sm"
                      }`}
                    >
                      <div
                        className={`text-xs font-bold ${
                          dark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        {stat.label}
                      </div>
                      <div className="text-3xl font-black mt-2 tracking-tight">
                        {stat.value}
                      </div>
                      <div className="mt-3 text-xs font-bold text-emerald-400">
                        {stat.change}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div
                    className={`lg:col-span-2 p-6 rounded-2xl border ${
                      dark
                        ? "border-white/[0.08] bg-white/[0.02]"
                        : "border-slate-200 bg-white shadow-sm"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-sm font-black">Outreach Performance</h2>
                      <div className="flex gap-1 bg-white/5 p-1 rounded-lg border border-white/10 text-[10px] font-bold">
                        <span className="px-2.5 py-1 rounded bg-cyan-500 text-white">
                          7D
                        </span>
                        <span className="px-2.5 py-1 rounded text-slate-400">
                          30D
                        </span>
                        <span className="px-2.5 py-1 rounded text-slate-400">
                          3M
                        </span>
                      </div>
                    </div>

                    <div
                      className={`h-60 rounded-xl flex items-end justify-between px-6 pt-10 pb-4 border ${
                        dark
                          ? "border-white/5 bg-[#05070e]"
                          : "border-slate-100 bg-slate-50"
                      }`}
                    >
                      {[35, 55, 45, 75, 65, 88, 72, 98].map((value, index) => (
                        <div
                          key={index}
                          className="w-8 bg-gradient-to-t from-cyan-600 to-blue-500 rounded-t-lg transition-all hover:opacity-80"
                          style={{ height: `${value}%` }}
                        />
                      ))}
                    </div>
                  </div>

                  <div
                    className={`p-6 rounded-2xl border bg-gradient-to-br ${
                      dark
                        ? "from-purple-950/50 via-[#0d0915] to-[#070a12] border-purple-500/30"
                        : "from-purple-50 via-white to-amber-50 border-purple-200"
                    } flex flex-col justify-between`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-amber-400 text-lg">👑</span>
                        <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                          ShareLite Premium
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold mt-1">
                        Unlock advanced features, more leads & higher limits.
                      </h3>
                    </div>

                    <div className="my-4 text-center py-4 px-3 rounded-xl bg-black/30 border border-purple-500/20">
                      <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                        Live Trial
                      </div>
                      <div className="text-2xl font-black text-amber-400 mt-1">
                        12 : 34 : 56
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Hrs : Min : Sec
                      </div>
                    </div>

                    <button className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-amber-500 text-white text-xs font-black shadow-lg shadow-purple-500/30 hover:opacity-95 transition">
                      Upgrade Now
                    </button>
                  </div>
                </div>
              </>
            )}

            {activeTab !== "dashboard" && (
              <div
                className={`p-12 rounded-2xl border text-center ${
                  dark
                    ? "border-white/[0.08] bg-white/[0.02]"
                    : "border-slate-200 bg-white shadow-sm"
                }`}
              >
                <div className="text-4xl mb-3">🚀</div>
                <h3 className="text-lg font-black capitalize">
                  {activeTab} Workspace Active
                </h3>
                <p
                  className={`text-xs mt-1 ${
                    dark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Enterprise data isolation active. All campaign metrics are secure.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`min-h-screen ${
        dark ? "bg-[#070a12] text-white" : "bg-[#f7f9fc] text-slate-900"
      }`}
    >
      <div className="grid min-h-screen lg:grid-cols-2">
        <section className="relative hidden min-h-screen overflow-hidden lg:flex">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1800&q=90')",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20" />

          <div className="absolute left-10 top-9 z-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-amber-500 text-white shadow-lg text-xl">
              👑
            </div>
            <div>
              <div className="text-[22px] font-black tracking-tight text-white">
                ShareLite
              </div>
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">
                Outreach Platform
              </div>
            </div>
          </div>

          <div className="absolute bottom-12 left-10 z-10 max-w-2xl">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">
              Smarter outreach
            </p>
            <h1 className="text-5xl font-black leading-[1.03] tracking-[-0.055em] text-white xl:text-7xl">
              Reach better.
              <br />
              Connect smarter.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/70 xl:text-base">
              Manage leads, create personalized outreach, and understand your
              campaign performance from one powerful workspace.
            </p>
          </div>
        </section>

        <section
          className={`relative flex min-h-screen items-center justify-center px-7 py-10 sm:px-12 xl:px-20 ${
            dark ? "bg-[#090d16]" : "bg-white"
          }`}
        >
          <button
            onClick={() => setDark(!dark)}
            className={`absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full transition ${
              dark
                ? "text-slate-300 hover:bg-white/10"
                : "text-slate-500 hover:bg-slate-100"
            }`}
            aria-label="Toggle theme"
          >
            {dark ? "☀" : "☾"}
          </button>

          <div className="w-full max-w-[460px]">
            <div className="mb-8">
              <div className="text-[30px] font-black tracking-tight flex items-center gap-2">
                <span>ShareLite</span>
                <span className="text-amber-400 text-lg">👑</span>
              </div>
              <div
                className={`mt-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
                  dark ? "text-slate-500" : "text-slate-400"
                }`}
              >
                Smarter outreach. Better conversations.
              </div>
            </div>

            <div className="mb-7">
              <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.22em] text-cyan-400">
                Welcome back
              </p>
              <h2 className="text-[38px] font-black leading-none tracking-tight">
                Sign in to continue.
              </h2>
              <p
                className={`mt-3 text-sm leading-6 ${
                  dark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Continue to your ShareLite workspace.
              </p>
            </div>

            <button
              onClick={() => setIsLoggedIn(true)}
              className={`flex h-13 w-full items-center justify-center gap-3 rounded-xl border text-sm font-bold transition ${
                dark
                  ? "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M21.35 12.27c0-.68-.06-1.34-.17-1.97H12v3.73h5.22a4.46 4.46 0 0 1-1.94 2.93v2.43h3.14c1.84-1.7 2.93-4.2 2.93-7.12Z"
                />
                <path
                  fill="#34A853"
                  d="M12 21.72c2.63 0 4.84-.87 6.45-2.36l-3.14-2.43c-.87.58-1.98.92-3.31.92-2.55 0-4.71-1.72-5.49-4.03H3.27v2.51A9.74 9.74 0 0 0 12 21.72Z"
                />
                <path
                  fill="#FBBC05"
                  d="M6.51 13.82a5.85 5.85 0 0 1 0-3.64V7.67H3.27a9.74 9.74 0 0 0 0 8.66l3.24-2.51Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 6.15c1.43 0 2.72.49 3.74 1.45l2.8-2.8C16.84 3.26 14.63 2.28 12 2.28a9.74 9.74 0 0 0-8.73 5.39l3.24 2.51C7.29 7.87 9.45 6.15 12 6.15Z"
                />
              </svg>
              Continue with Google
            </button>

            <div className="my-6 flex items-center gap-4">
              <div
                className={`h-px flex-1 ${
                  dark ? "bg-white/10" : "bg-slate-200"
                }`}
              />
              <span
                className={`text-[9px] font-bold uppercase tracking-[0.18em] ${
                  dark ? "text-slate-600" : "text-slate-400"
                }`}
              >
                or
              </span>
              <div
                className={`h-px flex-1 ${
                  dark ? "bg-white/10" : "bg-slate-200"
                }`}
              />
            </div>

            <label className="block">
              <span
                className={`mb-2 block text-xs font-bold ${
                  dark ? "text-slate-200" : "text-slate-700"
                }`}
              >
                Email address
              </span>
              <input
                type="email"
                defaultValue="gaurav@company.com"
                placeholder="name@company.com"
                className={`h-13 w-full rounded-xl border px-4 text-sm outline-none transition ${
                  dark
                    ? "border-white/10 bg-[#111827] text-white placeholder:text-slate-600 focus:border-cyan-400/60"
                    : "border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white"
                }`}
              />
            </label>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <span
                  className={`text-xs font-bold ${
                    dark ? "text-slate-200" : "text-slate-700"
                  }`}
                >
                  Password
                </span>
                <button className="text-xs font-bold text-cyan-400 hover:underline">
                  Forgot password?
                </button>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  defaultValue="••••••••••••"
                  placeholder="Enter your password"
                  className={`h-13 w-full rounded-xl border px-4 pr-16 text-sm outline-none transition ${
                    dark
                      ? "border-white/10 bg-[#111827] text-white placeholder:text-slate-600 focus:border-cyan-400/60"
                      : "border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <label
              className={`mt-4 flex items-center gap-2 text-xs cursor-pointer ${
                dark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              <input
                type="checkbox"
                defaultChecked
                className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
              />
              Remember me
            </label>

            <button
              onClick={() => setIsLoggedIn(true)}
              className="mt-6 h-13 w-full rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-500 text-sm font-extrabold text-white shadow-lg shadow-cyan-500/15 transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              Sign In
            </button>

            <div
              className={`mt-6 p-4 rounded-2xl border bg-gradient-to-r ${
                dark
                  ? "from-purple-950/40 via-indigo-950/30 to-[#0b0f19] border-purple-500/30"
                  : "from-purple-50 to-amber-50/40 border-purple-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-black">
                    <span>👑</span>
                    <span>ShareLite Pro</span>
                  </div>
                  <p
                    className={`text-xs mt-0.5 ${
                      dark ? "text-slate-300" : "text-slate-600"
                    }`}
                  >
                    Unlock advanced insights & higher limits.
                  </p>
                </div>
                <button
                  onClick={() => setIsLoggedIn(true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-amber-500 text-white text-xs font-black shadow-md shadow-purple-500/25"
                >
                  Explore
                </button>
              </div>
            </div>

            <div
              className={`mt-6 text-center text-xs ${
                dark ? "text-slate-500" : "text-slate-500"
              }`}
            >
              New to ShareLite?{" "}
              <button
                onClick={() => setIsLoggedIn(true)}
                className="font-extrabold text-cyan-400 hover:underline"
              >
                Create an account
              </button>
            </div>

            <div
              className={`mt-6 text-center text-[9px] ${
                dark ? "text-slate-700" : "text-slate-400"
              }`}
            >
              Secure Enterprise Workspace · Terms of Service · Privacy Policy
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
