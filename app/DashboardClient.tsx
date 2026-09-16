"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import type { AuthUser } from "@/lib/supabase-auth";

import type {
  Lead,
  LeadCounts,
  LeadStatus,
} from "@/lib/supabase-db";

import WorkspacePanels from "./WorkspacePanels";
import ReviewsPanel from "./ReviewsPanel";

type DashboardClientProps = {
  user: AuthUser;
  initialLeads: Lead[];
  initialCounts: LeadCounts;
  dataError?: string;
};

type AnalyticsRange = "7d" | "30d" | "3m";

type PerformancePoint = {
  date: string;
  leads: number;
  campaigns: number;
};

const emptyLead = {
  name: "",
  email: "",
  company: "",
  website: "",
  status: "new" as LeadStatus,
  source: "",
};

function getFirstName(user: AuthUser): string {
  const rawUser = user as AuthUser & {
    email?: string;
    user_metadata?: {
      name?: string;
      full_name?: string;
      first_name?: string;
    };
  };

  const metadata = rawUser.user_metadata;

  const savedName =
    metadata?.name ||
    metadata?.full_name ||
    metadata?.first_name ||
    "";

  const emailName = rawUser.email?.split("@")[0] || "";

  const nameToUse = String(savedName || emailName || "User")
    .trim()
    .replace(/[._-]+/g, " ");

  const firstName = nameToUse.split(/\s+/)[0];

  if (!firstName) {
    return "User";
  }

  return (
    firstName.charAt(0).toUpperCase() +
    firstName.slice(1).toLowerCase()
  );
}

export default function DashboardClient({
  user,
  initialLeads,
  initialCounts,
  dataError,
}: DashboardClientProps) {
  const [dark, setDark] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");

  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [counts, setCounts] = useState<LeadCounts>(initialCounts);

  const [leadForm, setLeadForm] = useState(emptyLead);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState(false);

  const [aiMessages, setAiMessages] = useState<Record<string, string>>(
    {}
  );

  const [analyticsRange, setAnalyticsRange] =
    useState<AnalyticsRange>("7d");

  const [performance, setPerformance] = useState<PerformancePoint[]>(
    []
  );

  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [trialSeconds, setTrialSeconds] = useState<number | null>(
    120 * 3600
  );

  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const [checkoutPlan, setCheckoutPlan] = useState<
    "premium" | "premium_pro"
  >("premium_pro");

  const [checkoutPending, setCheckoutPending] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(
    null
  );

  const [logoutOpen, setLogoutOpen] = useState(false);

  const firstName = getFirstName(user);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "campaigns", label: "Campaigns", icon: "🚀" },
    { id: "leads", label: "Leads", icon: "👥" },
    { id: "templates", label: "Templates", icon: "📝" },
    { id: "reviews", label: "Reviews", icon: "⭐" },
    { id: "analytics", label: "Analytics", icon: "📈" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  const stats = [
    {
      label: "Total Leads",
      value: counts.total.toLocaleString(),
      change: "Current total",
    },
    {
      label: "Valid Leads",
      value: counts.valid.toLocaleString(),
      change: "Current status",
    },
    {
      label: "Contacted",
      value: counts.contacted.toLocaleString(),
      change: "Current status",
    },
    {
      label: "Converted",
      value: counts.converted.toLocaleString(),
      change: "Current status",
    },
  ];

  const leadRows = useMemo(() => leads, [leads]);

  const graphPoints = useMemo(() => {
    if (performance.length <= 8) {
      return performance;
    }

    const bucketSize = Math.ceil(performance.length / 8);

    return Array.from(
      { length: Math.ceil(performance.length / bucketSize) },
      (_, index) =>
        performance
          .slice(index * bucketSize, (index + 1) * bucketSize)
          .reduce(
            (total, point) => ({
              date: point.date,
              leads: total.leads + point.leads,
              campaigns: total.campaigns + point.campaigns,
            }),
            {
              date: performance[index * bucketSize]?.date ?? "",
              leads: 0,
              campaigns: 0,
            }
          )
    );
  }, [performance]);

  const graphMax = Math.max(
    1,
    ...graphPoints.map((point) => point.leads + point.campaigns)
  );
  const hasPerformanceData = graphPoints.some(
  (point) => point.leads > 0 || point.campaigns > 0
);
  const countdown =
    trialSeconds === null
      ? "-- : -- : --"
      : `${String(Math.floor(trialSeconds / 3600)).padStart(
          2,
          "0"
        )} : ${String(
          Math.floor((trialSeconds % 3600) / 60)
        ).padStart(2, "0")} : ${String(trialSeconds % 60).padStart(
          2,
          "0"
        )}`;

  async function refreshLeads() {
    const response = await fetch("/api/leads", {
      cache: "no-store",
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(body?.error ?? "Unable to load leads.");
    }

    setLeads(Array.isArray(body?.leads) ? body.leads : []);

    setCounts(
      body?.counts ?? {
        total: 0,
        valid: 0,
        contacted: 0,
        converted: 0,
      }
    );
  }

  async function refreshDashboard() {
    setRefreshing(true);
    setRefreshError(null);

    try {
      const [
        leadsResponse,
        analyticsResponse,
        subscriptionResponse,
      ] = await Promise.all([
        fetch("/api/leads", { cache: "no-store" }),
        fetch(`/api/analytics?range=${analyticsRange}`, {
          cache: "no-store",
        }),
        fetch("/api/subscription", { cache: "no-store" }),
      ]);

      const [
        leadsBody,
        analyticsBody,
        subscriptionBody,
      ] = await Promise.all([
        leadsResponse.json().catch(() => null),
        analyticsResponse.json().catch(() => null),
        subscriptionResponse.json().catch(() => null),
      ]);

      if (!leadsResponse.ok) {
        throw new Error(
          leadsBody?.error ?? "Unable to load dashboard data."
        );
      }

      setLeads(leadsBody?.leads ?? []);

      setCounts(
        leadsBody?.counts ?? {
          total: 0,
          valid: 0,
          contacted: 0,
          converted: 0,
        }
      );

      if (analyticsResponse.ok) {
        setPerformance(analyticsBody?.performance ?? []);
      }

      if (subscriptionResponse.ok) {
        const end =
          subscriptionBody?.trialEndsAt ??
          subscriptionBody?.subscription?.current_period_end;

        if (
          typeof end === "string" &&
          Number.isFinite(new Date(end).getTime())
        ) {
          setTrialEndsAt(end);
        }
      }
    } catch (error) {
      setRefreshError(
        error instanceof Error
          ? error.message
          : "Unable to refresh dashboard."
      );
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadExtras() {
      const [
        analyticsResponse,
        subscriptionResponse,
      ] = await Promise.all([
        fetch(`/api/analytics?range=${analyticsRange}`, {
          cache: "no-store",
        }),
        fetch("/api/subscription", {
          cache: "no-store",
        }),
      ]);

      const analyticsBody = await analyticsResponse
        .json()
        .catch(() => null);

      const subscriptionBody = await subscriptionResponse
        .json()
        .catch(() => null);

      if (
        !cancelled &&
        analyticsResponse.ok &&
        Array.isArray(analyticsBody?.performance)
      ) {
        setPerformance(analyticsBody.performance);
      }

      if (!cancelled && subscriptionResponse.ok) {
        const end =
          subscriptionBody?.trialEndsAt ??
          subscriptionBody?.subscription?.current_period_end;

        if (
          typeof end === "string" &&
          Number.isFinite(new Date(end).getTime())
        ) {
          setTrialEndsAt(end);
        }
      }
    }

    void loadExtras();

    return () => {
      cancelled = true;
    };
  }, [analyticsRange]);

  useEffect(() => {
    if (!trialEndsAt) {
      return;
    }

    const updateCountdown = () => {
      const seconds = Math.max(
        0,
        Math.ceil(
          (new Date(trialEndsAt).getTime() - Date.now()) / 1000
        )
      );

      setTrialSeconds(seconds);
    };

    updateCountdown();

    const interval = window.setInterval(updateCountdown, 1000);

    return () => window.clearInterval(interval);
  }, [trialEndsAt]);

  async function submitLead(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setLeadError(null);

  const company = leadForm.company.trim();

  if (!company) {
    setLeadError("Company name is required.");
    return;
  }

  setPending(true);

  try {
    const response = await fetch(
      editingId ? `/api/leads/${editingId}` : "/api/leads",
      {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...leadForm,
          company,
        }),
      },
    );

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(body?.error ?? "Unable to save lead.");
    }

    await refreshLeads();
    setLeadForm(emptyLead);
    setEditingId(null);
  } catch (error) {
    setLeadError(
      error instanceof Error
        ? error.message
        : "Unable to save lead.",
    );
  } finally {
    setPending(false);
  }
}
  function editLead(lead: Lead) {
    setEditingId(lead.id);

    setLeadForm({
      name: lead.name,
      email: lead.email,
      company: lead.company ?? "",
      website: lead.website ?? "",
      status: lead.status,
      source: lead.source ?? "",
    });
  }

  async function removeLead(id: string) {
    setLeadError(null);

    const response = await fetch(`/api/leads/${id}`, {
      method: "DELETE",
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setLeadError(body?.error ?? "Unable to delete lead.");
      return;
    }

    await refreshLeads();
  }
  async function importCsv(event: React.ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  setImporting(true);
  setImportSummary(null);
  setLeadError(null);

  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/leads/import", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "CSV import failed.");
    }

    setImportSummary(
      `Imported: ${data.imported}, Invalid: ${data.invalid}, Duplicates: ${data.duplicates}, Skipped by limit: ${data.skippedByLimit}`
    );

    await refreshLeads();
  } catch (error) {
    setLeadError(
      error instanceof Error ? error.message : "CSV import failed."
    );
  } finally {
    setImporting(false);

    if (csvInputRef.current) {
      csvInputRef.current.value = "";
    }
  }
}

    function downloadCsvTemplate() {
    const csvContent =
      "name,email,company,website\n" +
      "John Doe,john@example.com,Example Company,https://example.com\n";

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "sharelite-leads-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  async function validateLead(id: string) {
    setLeadError(null);

    const response = await fetch(`/api/leads/${id}/validate`, {
      method: "POST",
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setLeadError(body?.error ?? "Unable to validate email.");
      return;
    }

    await refreshLeads();
  }

  async function generateAiMessage(id: string) {
    setLeadError(null);

    const response = await fetch(`/api/leads/${id}/ai-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        goal: "Introduce ShareLite and start a relevant conversation",
        tone: "professional",
      }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setLeadError(
        body?.error ?? "Unable to generate AI message."
      );
      return;
    }

    setAiMessages((current) => ({
      ...current,
      [id]: body.message,
    }));
  }

  async function startCheckout() {
    setCheckoutPending(true);
    setCheckoutError(null);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan: checkoutPlan,
        }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok || typeof body?.url !== "string") {
        throw new Error(
          body?.error ?? "Unable to start checkout."
        );
      }

      window.location.assign(body.url);
    } catch (error) {
      setCheckoutError(
        error instanceof Error
          ? error.message
          : "Unable to start checkout."
      );
      setCheckoutPending(false);
    }
  }

  return (
    <main
      className={`min-h-screen flex flex-col md:flex-row ${
        dark
          ? "bg-[#070a12] text-slate-100"
          : "bg-slate-50 text-slate-900"
      }`}
    >
      <aside
        className={`w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-r p-4 md:p-6 flex flex-col justify-between ${
          dark
            ? "border-white/10 bg-[#0b0f19]"
            : "border-slate-200 bg-white"
        }`}
      >
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-600 to-amber-500 flex items-center justify-center text-xl">
              👑
            </div>

            <div>
              <div className="font-black text-lg">ShareLite</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400">
                Outreach Platform
              </div>
            </div>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition ${
                  activeTab === item.id
                    ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white"
                    : dark
                    ? "text-slate-400 hover:bg-white/5"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-8 rounded-2xl border border-purple-500/30 bg-purple-950/30 p-4">
          <div className="text-xs font-black uppercase text-amber-400">
            👑 Upgrade to Pro
          </div>

          <p className="mt-2 text-xs text-slate-300">
            Unlock advanced features, more leads and higher limits.
          </p>

         <Link
   href="/plans"
   className="block w-full rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-amber-500 px-4 py-3 text-center text-xs font-black text-white transition hover:scale-[1.02]"
>
   View Plans
 </Link>
        </div>
      </aside>

      <section className="flex-1 min-w-0">
        <header
          className={`sticky top-0 z-20 flex min-h-[72px] flex-wrap items-center justify-between gap-4 border-b px-5 py-4 md:px-8 ${
            dark
              ? "border-white/10 bg-[#070a12]/90"
              : "border-slate-200 bg-white/90"
          }`}
        >
          <button
            type="button"
            onClick={() => void refreshDashboard()}
            disabled={refreshing}
            className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-400 disabled:opacity-60"
          >
            {refreshing ? "Refreshing..." : "● Live · Refresh"}
          </button>

          <div className="flex items-center gap-3">
            <Link
  href="/plans"
  className="rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-amber-500 px-4 py-2 text-xs font-black text-white transition hover:scale-[1.02]"
>
  Upgrade
</Link>
            <button
              type="button"
              onClick={() => setDark((value) => !value)}
              className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold"
            >
              {dark ? "☀ Light Mode" : "☾ Dark Mode"}
            </button>

            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-xs font-black text-white">
                {firstName.charAt(0)}
              </div>

              <span className="text-xs font-bold">{firstName}</span>

              <button
                type="button"
                onClick={() => setLogoutOpen(true)}
                className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-400"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-7xl space-y-8 p-5 md:p-8">
          {activeTab === "dashboard" && (
            <>
              <div>
                <h1 className="flex items-center gap-2 text-2xl font-black">
                  Welcome, {firstName}
                  <span className="text-amber-400">👑</span>
                </h1>

                <p className="mt-2 text-xs text-slate-400">
                  Here is what is happening in your outreach journey today.
                </p>
              </div>

              {(dataError || refreshError) && (
                <p role="alert" className="text-sm text-rose-400">
                  {refreshError ?? dataError}
                </p>
              )}

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className={`rounded-2xl border p-5 ${
                      dark
                        ? "border-white/10 bg-white/[0.03]"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-400">
                      {stat.label}
                    </div>

                    <div className="mt-2 text-3xl font-black">
                      {stat.value}
                    </div>

                    <div className="mt-3 text-xs font-bold text-emerald-400">
                      {stat.change}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div
                  className={`rounded-2xl border p-6 lg:col-span-2 ${
                    dark
                      ? "border-white/10 bg-white/[0.03]"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-sm font-black">
                      Outreach Performance
                    </h2>

                    <div className="flex gap-1">
                      {(["7d", "30d", "3m"] as AnalyticsRange[]).map(
                        (range) => (
                          <button
                            key={range}
                            type="button"
                            onClick={() => setAnalyticsRange(range)}
                            className={`rounded-lg px-3 py-2 text-xs font-bold ${
                              analyticsRange === range
                                ? "bg-cyan-500 text-white"
                                : "bg-white/5 text-slate-400"
                            }`}
                          >
                            {range.toUpperCase()}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {!hasPerformanceData ? (
                    <div className="flex h-48 items-center justify-center text-sm text-slate-400">
                      No outreach activity yet.
                    </div>
                  ) : (
                    <div className="flex h-48 items-end gap-2">
                      {graphPoints.map((point) => (
                        <div
                          key={point.date}
                          title={`${point.date}: ${
                            point.leads + point.campaigns
                          } activities`}
                          className="flex-1 rounded-t-lg bg-gradient-to-t from-cyan-600 to-blue-500"
                          style={{
                            height: `${
                              ((point.leads + point.campaigns) /
                                graphMax) *
                              100
                            }%`,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-purple-500/30 bg-purple-950/30 p-6">
                  <div className="text-xs font-black uppercase text-amber-400">
                    👑 ShareLite Premium
                  </div>

                  <h3 className="mt-3 text-lg font-black">
                    Unlock advanced features and higher limits.
                  </h3>

                  <div className="my-6 rounded-xl bg-black/30 p-4 text-center">
                    <div className="text-[10px] uppercase text-slate-400">
                      Live Trial
                    </div>

                    <div className="mt-2 text-2xl font-black text-amber-400">
                      {countdown}
                    </div>

                    <div className="text-[10px] text-slate-400">
                      Hrs : Min : Sec
                    </div>
                  </div>

                  <Link
  href="/plans"
  className="block w-full rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-amber-500 px-4 py-3 text-center text-xs font-black text-white transition hover:scale-[1.02]"
>
  Upgrade Now
</Link>
                </div>
              </div>
            </>
          )}

          {activeTab === "leads" && (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
  <div>
    <h2 className="text-2xl font-black">Leads</h2>

    <p className="mt-1 text-xs text-slate-400">
      Manage your outreach leads.
    </p>
  </div>

  <div className="flex flex-wrap items-center gap-2">
    <input
      ref={csvInputRef}
      type="file"
      accept=".csv,text/csv"
      onChange={importCsv}
      className="hidden"
      id="csv-leads-upload"
    />

    <label
      htmlFor="csv-leads-upload"
      className={`cursor-pointer rounded-xl border px-4 py-3 text-xs font-black transition ${
        dark
          ? "border-white/10 bg-white/5 text-white hover:bg-white/10"
          : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
      } ${importing ? "pointer-events-none opacity-60" : ""}`}
    >
      {importing ? "Importing..." : "Import CSV"}
    </label>
    <button
  type="button"
  onClick={downloadCsvTemplate}
  className={`rounded-xl border px-4 py-3 text-xs font-black transition ${
    dark
      ? "border-white/10 bg-white/5 text-white hover:bg-white/10"
      : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
  }`}
>
  Download Template
</button>


  </div>
</div>
              <form
                onSubmit={submitLead}
                className={`grid grid-cols-1 gap-3 rounded-2xl border p-5 md:grid-cols-3 ${
                  dark
                    ? "border-white/10 bg-white/[0.03]"
                    : "border-slate-200 bg-white"
                }`}
              >
                <input
                  required
                  placeholder="Name"
                  value={leadForm.name}
                  onChange={(event) =>
                    setLeadForm({
                      ...leadForm,
                      name: event.target.value,
                    })
                  }
                  className="rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm"
                />

                <input
                  required
                  type="email"
                  placeholder="Email"
                  value={leadForm.email}
                  onChange={(event) =>
                    setLeadForm({
                      ...leadForm,
                      email: event.target.value,
                    })
                  }
                  className="rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm"
                />

                <input
                  required
                  placeholder="Company"
                  value={leadForm.company}
                  onChange={(event) =>
                    setLeadForm({
                      ...leadForm,
                      company: event.target.value,
                    })
                  }
                  className="rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm"
                />

                <input
                  placeholder="Website"
                  value={leadForm.website}
                  onChange={(event) =>
                    setLeadForm({
                      ...leadForm,
                      website: event.target.value,
                    })
                  }
                  className="rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm"
                />

                <select
                  value={leadForm.status}
                  onChange={(event) =>
                    setLeadForm({
                      ...leadForm,
                      status: event.target.value as LeadStatus,
                    })
                  }
                  className="rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm"
                >
                  <option value="new">New</option>
                  <option value="valid">Valid</option>
                  <option value="contacted">Contacted</option>
                  <option value="converted">Converted</option>
                </select>

                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-xl bg-cyan-500 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
                >
                  {pending
                    ? "Saving..."
                    : editingId
                    ? "Save Lead"
                    : "Add Lead"}
                </button>
              </form>

              {leadError && (
                <p role="alert" className="text-sm text-rose-400">
                  {leadError}
                </p>
              )}
              {importSummary && (
  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
    {importSummary}
  </div>
)}
              <div className="space-y-3">
                {leadRows.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 p-6 text-sm text-slate-400">
                    No leads yet.
                  </div>
                ) : (
                  leadRows.map((lead) => (
                    <div
                      key={lead.id}
                      className={`rounded-2xl border p-4 ${
                        dark
                          ? "border-white/10 bg-white/[0.03]"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-col justify-between gap-4 md:flex-row">
                        <div>
                          <div className="font-bold">{lead.name}</div>

                          <div className="text-xs text-slate-400">
                            {lead.email}
                            {lead.company
                              ? ` · ${lead.company}`
                              : ""}
                          </div>

                          <div className="mt-1 text-xs capitalize text-slate-500">
                            Status: {lead.status}
                          </div>

                          {lead.validation_status && (
                            <div className="mt-1 text-xs text-cyan-400">
                              Email: {lead.validation_status}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => editLead(lead)}
                            className="rounded-lg bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-400"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => void validateLead(lead.id)}
                            className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-bold text-white"
                          >
                            Validate
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void generateAiMessage(lead.id)
                            }
                            className="rounded-lg bg-purple-500 px-3 py-2 text-xs font-bold text-white"
                          >
                            AI Message
                          </button>

                          <button
                            type="button"
                            onClick={() => void removeLead(lead.id)}
                            className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-400"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {aiMessages[lead.id] && (
                        <textarea
                          value={aiMessages[lead.id]}
                          onChange={(event) =>
                            setAiMessages((current) => ({
                              ...current,
                              [lead.id]: event.target.value,
                            }))
                          }
                          className="mt-4 min-h-28 w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-sm"
                        />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "reviews" && <ReviewsPanel dark={dark} />}

          {activeTab !== "dashboard" &&
            activeTab !== "leads" &&
            activeTab !== "reviews" && (
              <WorkspacePanels
                activeTab={activeTab}
                user={user}
                dark={dark}
              />
            )}
        </div>
      </section>

      {logoutOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5"
          onClick={() => setLogoutOpen(false)}
        >
          <div
            className={`w-full max-w-sm rounded-2xl border p-6 ${
              dark
                ? "border-white/10 bg-[#111827]"
                : "border-slate-200 bg-white"
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-black">
              Are you sure you want to log out?
            </h2>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setLogoutOpen(false)}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold"
              >
                Cancel
              </button>

              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-black text-white"
                >
                  Logout
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}