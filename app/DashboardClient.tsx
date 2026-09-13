"use client";

import { useEffect, useMemo, useState } from "react";
import type { AuthUser } from "@/lib/supabase-auth";
import type { Lead, LeadCounts, LeadStatus, Profile } from "@/lib/supabase-db";
import WorkspacePanels from "./WorkspacePanels";
import ReviewsPanel from "./ReviewsPanel";

type DashboardClientProps = {
  user: AuthUser;
  profile: Profile | null;
  initialLeads: Lead[];
  initialCounts: LeadCounts;
  dataError?: string;
};

const emptyLead = { name: "", email: "", company: "", website: "", status: "new" as LeadStatus, source: "" };
type AnalyticsRange = "7d" | "30d" | "3m";
type PerformancePoint = { date: string; leads: number; campaigns: number };

export default function DashboardClient({ user, profile, initialLeads, initialCounts, dataError }: DashboardClientProps) {
  const [dark, setDark] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [leads, setLeads] = useState(initialLeads);
  const [counts, setCounts] = useState(initialCounts);
  const [leadForm, setLeadForm] = useState(emptyLead);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [aiMessages, setAiMessages] = useState<Record<string, string>>({});
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>("7d");
  const [performance, setPerformance] = useState<PerformancePoint[]>([]);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [trialSeconds, setTrialSeconds] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<"premium" | "premium_pro">("premium_pro");
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
  const firstName = profile?.first_name ?? profile?.name?.trim().split(/\s+/)[0] ?? "there";

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
    { label: "Total Leads", value: counts.total.toLocaleString(), change: "Current total" },
    { label: "Valid Leads", value: counts.valid.toLocaleString(), change: "Current status" },
    { label: "Contacted", value: counts.contacted.toLocaleString(), change: "Current status" },
    { label: "Converted", value: counts.converted.toLocaleString(), change: "Current status" },
  ];

  const leadRows = useMemo(() => leads, [leads]);
  const graphPoints = useMemo(() => {
    if (performance.length <= 8) return performance;
    const bucketSize = Math.ceil(performance.length / 8);
    return Array.from({ length: Math.ceil(performance.length / bucketSize) }, (_, index) =>
      performance.slice(index * bucketSize, (index + 1) * bucketSize).reduce(
        (total, point) => ({ date: point.date, leads: total.leads + point.leads, campaigns: total.campaigns + point.campaigns }),
        { date: performance[index * bucketSize]?.date ?? "", leads: 0, campaigns: 0 }
      )
    );
  }, [performance]);
  const graphMax = Math.max(1, ...graphPoints.map((point) => point.leads + point.campaigns));
  const countdown = trialSeconds === null
    ? "-- : -- : --"
    : `${String(Math.floor(trialSeconds / 3600)).padStart(2, "0")} : ${String(Math.floor((trialSeconds % 3600) / 60)).padStart(2, "0")} : ${String(trialSeconds % 60).padStart(2, "0")}`;

  async function refreshDashboard() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const [leadsResponse, analyticsResponse, subscriptionResponse] = await Promise.all([
        fetch("/api/leads", { cache: "no-store" }),
        fetch(`/api/analytics?range=${analyticsRange}`, { cache: "no-store" }),
        fetch("/api/subscription", { cache: "no-store" }),
      ]);
      const [leadsBody, analyticsBody, subscriptionBody] = await Promise.all([
        leadsResponse.json().catch(() => null),
        analyticsResponse.json().catch(() => null),
        subscriptionResponse.json().catch(() => null),
      ]);
      if (!leadsResponse.ok) throw new Error(leadsBody?.error ?? "Unable to load dashboard data.");
      if (!analyticsResponse.ok) throw new Error(analyticsBody?.error ?? "Unable to load dashboard analytics.");
      if (!subscriptionResponse.ok) throw new Error(subscriptionBody?.error ?? "Unable to load subscription.");
      setLeads(Array.isArray(leadsBody?.leads) ? leadsBody.leads : []);
      setCounts(leadsBody?.counts ?? { total: 0, valid: 0, contacted: 0, converted: 0 });
      setPerformance(Array.isArray(analyticsBody?.performance) ? analyticsBody.performance : []);
      const end = subscriptionBody?.trialEndsAt ?? subscriptionBody?.subscription?.current_period_end;
      if (typeof end === "string" && Number.isFinite(new Date(end).getTime())) setTrialEndsAt(end);
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "Unable to refresh dashboard.");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function loadDashboardExtras() {
      const [analyticsResponse, subscriptionResponse] = await Promise.all([
        fetch(`/api/analytics?range=${analyticsRange}`, { cache: "no-store" }),
        fetch("/api/subscription", { cache: "no-store" }),
      ]);
      const analyticsBody = await analyticsResponse.json().catch(() => null);
      const subscriptionBody = await subscriptionResponse.json().catch(() => null);
      if (!cancelled && analyticsResponse.ok && Array.isArray(analyticsBody?.performance)) setPerformance(analyticsBody.performance);
      if (!cancelled && subscriptionResponse.ok) {
        const end = subscriptionBody?.trialEndsAt ?? subscriptionBody?.subscription?.current_period_end;
        if (typeof end === "string" && Number.isFinite(new Date(end).getTime())) setTrialEndsAt(end);
      }
    }
    void loadDashboardExtras();
    return () => { cancelled = true; };
  }, [analyticsRange]);

  useEffect(() => {
    if (!trialEndsAt) return;
    const update = () => setTrialSeconds(Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 1000)));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [trialEndsAt]);

  async function refreshLeads() {
    const response = await fetch("/api/leads", { cache: "no-store" });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error ?? "Unable to load leads.");
    setLeads(body.leads ?? []);
    setCounts(body.counts ?? { total: 0, valid: 0, contacted: 0, converted: 0 });
  }

  async function submitLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLeadError(null);
    setPending(true);
    try {
      const response = await fetch(editingId ? `/api/leads/${editingId}` : "/api/leads", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leadForm),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Unable to save lead.");
      await refreshLeads();
      setLeadForm(emptyLead);
      setEditingId(null);
    } catch (error) {
      setLeadError(error instanceof Error ? error.message : "Unable to save lead.");
    } finally {
      setPending(false);
    }
  }

  async function validateLead(id: string) {
    setLeadError(null);
    const response = await fetch(`/api/leads/${id}/validate`, { method: "POST" });
    const body = await response.json().catch(() => null);
    if (!response.ok) { setLeadError(body?.error ?? "Unable to validate lead email."); return; }
    await refreshLeads();
  }

  async function generateAiMessage(id: string) {
    setLeadError(null);
    const response = await fetch(`/api/leads/${id}/ai-message`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal: "Introduce ShareLite and start a relevant conversation", tone: "professional" }) });
    const body = await response.json().catch(() => null);
    if (!response.ok) { setLeadError(body?.error ?? "Unable to generate a message."); return; }
    setAiMessages((current) => ({ ...current, [id]: body.message }));
  }

  async function removeLead(id: string) {
    setLeadError(null);
    const response = await fetch(`/api/leads/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setLeadError(body?.error ?? "Unable to delete lead.");
      return;
    }
    await refreshLeads();
  }

  function editLead(lead: Lead) {
    setEditingId(lead.id);
    setLeadForm({ name: lead.name, email: lead.email, company: lead.company ?? "", website: lead.website ?? "", status: lead.status, source: lead.source ?? "" });
  }

  async function startCheckout() {
    setCheckoutPending(true);
    setCheckoutError(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: checkoutPlan }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || typeof body?.url !== "string") throw new Error(body?.error ?? "Unable to start checkout.");
      window.location.assign(body.url);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Unable to start checkout.");
      setCheckoutPending(false);
    }
  }

  return (
      <main
        className={`min-h-screen flex flex-col md:flex-row ${
          dark
            ? "bg-[#070a12] text-slate-100"
            : "bg-[#f8fafc] text-slate-900"
        }`}
      >
        <aside
          className={`w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-r flex flex-col justify-between p-4 md:p-6 transition-colors duration-300 ${
            dark
              ? "border-white/[0.08] bg-[#0b0f19]"
              : "border-slate-200 bg-white"
          }`}
        >
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 via-indigo-600 to-amber-500 text-white shadow-lg shadow-purple-500/25 font-bold text-lg">👑</div>
              <div><div className="text-base font-black tracking-tight">ShareLite</div><div className={`text-[10px] font-semibold uppercase tracking-wider ${dark ? "text-slate-400" : "text-slate-500"}`}>Outreach Platform</div></div>
            </div>
            <nav className="space-y-1.5">
              {navItems.map((item) => <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full cursor-pointer flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === item.id ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-cyan-500/20" : dark ? "text-slate-400 hover:bg-white/5 hover:text-slate-200" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}><span className="text-sm">{item.icon}</span><span>{item.label}</span></button>)}
            </nav>
          </div>
          <div className={`p-4 rounded-2xl border bg-gradient-to-b relative overflow-hidden ${dark ? "from-purple-950/40 via-[#0d0915] to-[#0b0f19] border-purple-500/30" : "from-purple-50 via-amber-50/30 to-white border-purple-200"}`}><div className="flex items-center gap-2 mb-1.5"><span className="text-amber-400 text-base">👑</span><span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Upgrade to Pro</span></div><p className={`text-[11px] leading-relaxed mb-3 ${dark ? "text-slate-300" : "text-slate-600"}`}>Unlock advanced features, more leads & higher limits.</p><select aria-label="Upgrade plan" value={checkoutPlan} onChange={(event) => setCheckoutPlan(event.target.value as "premium" | "premium_pro")} className="mb-2 w-full rounded-lg border border-white/10 bg-[#111827] px-2 py-2 text-xs"><option value="premium">Premium</option><option value="premium_pro">Premium Pro</option></select><button onClick={() => void startCheckout()} disabled={checkoutPending} className="w-full cursor-pointer py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-amber-500 text-white text-xs font-black shadow-lg shadow-purple-500/25 hover:opacity-95 transition disabled:cursor-not-allowed disabled:opacity-60">{checkoutPending ? "Opening checkout…" : "Upgrade Now"}</button>{checkoutError && <p role="alert" className="mt-2 text-[11px] text-rose-400">{checkoutError}</p>}</div>
        </aside>

        <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">
          <header className={`h-[72px] border-b px-8 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md ${dark ? "border-white/[0.08] bg-[#070a12]/80" : "border-slate-200 bg-white/80"}`}><div className="flex items-center gap-4"><button type="button" onClick={() => void refreshDashboard()} disabled={refreshing} aria-label="Refresh dashboard" className={`relative cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-70 ${dark ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}><span className={`h-2 w-2 rounded-full bg-emerald-500 ${refreshing ? "animate-spin" : "animate-pulse"}`} />{refreshing ? "Refreshing…" : "Live · Refresh"}</button></div><div className="flex items-center gap-4"><button onClick={() => setDark(!dark)} className={`cursor-pointer p-2.5 rounded-xl border transition ${dark ? "border-white/10 bg-white/5 text-amber-400 hover:bg-white/10" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>{dark ? "☀ Light Mode" : "☾ Dark Mode"}</button><div className="flex items-center gap-2.5 pl-2 border-l border-white/10"><div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center font-bold text-white text-xs shadow">{firstName.charAt(0).toUpperCase()}</div><div className="text-xs font-bold">{firstName}</div><button type="button" onClick={() => setLogoutOpen(true)} className="ml-2 cursor-pointer px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition">Logout</button></div></div></header>

          <div className="p-8 max-w-7xl w-full mx-auto space-y-8">
            {activeTab === "dashboard" && <>
              <div><h1 className="text-2xl font-black tracking-tight flex items-center gap-2">{greeting}, {firstName} <span className="text-amber-400">👑</span></h1><p className={`text-xs mt-1 ${dark ? "text-slate-400" : "text-slate-500"}`}>Here is what is happening in your outreach journey today.</p></div>
              {(dataError || refreshError) && <p role="alert" className="text-sm text-rose-400">{refreshError ?? dataError}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">{stats.map((stat) => <div key={stat.label} className={`p-5 rounded-2xl border transition-all ${dark ? "border-white/[0.08] bg-white/[0.02]" : "border-slate-200 bg-white shadow-sm"}`}><div className={`text-xs font-bold ${dark ? "text-slate-400" : "text-slate-500"}`}>{stat.label}</div><div className="text-3xl font-black mt-2 tracking-tight">{stat.value}</div><div className="mt-3 text-xs font-bold text-emerald-400">{stat.change}</div></div>)}</div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><div className={`lg:col-span-2 p-6 rounded-2xl border ${dark ? "border-white/[0.08] bg-white/[0.02]" : "border-slate-200 bg-white shadow-sm"}`}><div className="flex items-center justify-between mb-6"><h2 className="text-sm font-black">Outreach Performance</h2><div className="flex gap-1 bg-white/5 p-1 rounded-lg border border-white/10 text-[10px] font-bold">{([ ["7d", "7D"], ["30d", "30D"], ["3m", "3M"] ] as const).map(([value, label]) => <button type="button" key={value} onClick={() => setAnalyticsRange(value)} className={`px-2.5 py-1 rounded ${analyticsRange === value ? "bg-cyan-500 text-white" : "text-slate-400"}`}>{label}</button>)}</div></div><div className={`h-60 rounded-xl flex items-center justify-center px-6 pt-10 pb-4 border ${dark ? "border-white/5 bg-[#05070e]" : "border-slate-100 bg-slate-50"}`}>{graphPoints.length === 0 || graphPoints.every((point) => point.leads + point.campaigns === 0) ? <div className="text-center"><p className={`text-sm font-bold ${dark ? "text-slate-200" : "text-slate-700"}`}>No outreach activity yet</p><p className={`mt-1 text-xs ${dark ? "text-slate-500" : "text-slate-500"}`}>Add leads or launch a campaign to see performance here.</p></div> : <div className="w-full h-full flex items-end justify-between">{graphPoints.map((point) => <div key={point.date} title={`${point.date}: ${point.leads} leads, ${point.campaigns} campaigns`} className="flex-1 max-w-8 bg-gradient-to-t from-cyan-600 to-blue-500 rounded-t-lg transition-all hover:opacity-80" style={{ height: `${((point.leads + point.campaigns) / graphMax) * 100}%` }} />)}</div>}</div></div><div className={`p-6 rounded-2xl border bg-gradient-to-br ${dark ? "from-purple-950/50 via-[#0d0915] to-[#070a12] border-purple-500/30" : "from-purple-50 via-white to-amber-50 border-purple-200"} flex flex-col justify-between`}><div><div className="flex items-center gap-2 mb-2"><span className="text-amber-400 text-lg">👑</span><span className="text-xs font-black uppercase tracking-wider text-amber-400">ShareLite Premium</span></div><h3 className="text-base font-extrabold mt-1">Unlock advanced features, more leads & higher limits.</h3></div><div className="my-4 text-center py-4 px-3 rounded-xl bg-black/30 border border-purple-500/20"><div className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Live Trial</div><div className="text-2xl font-black text-amber-400 mt-1">{countdown}</div><div className="text-[10px] text-slate-400 mt-0.5">Hrs : Min : Sec</div></div><button className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-amber-500 text-white text-xs font-black shadow-lg shadow-purple-500/30 hover:opacity-95 transition">Upgrade Now</button></div></div>
            </>}

            {activeTab === "leads" && <div className="space-y-6"><div><h2 className="text-xl font-black">Leads</h2><p className={`text-xs mt-1 ${dark ? "text-slate-400" : "text-slate-500"}`}>Manage your user-scoped outreach leads.</p></div><form onSubmit={submitLead} className={`grid grid-cols-1 md:grid-cols-3 gap-3 p-5 rounded-2xl border ${dark ? "border-white/[0.08] bg-white/[0.02]" : "border-slate-200 bg-white shadow-sm"}`}><input required placeholder="Name" value={leadForm.name} onChange={(event) => setLeadForm({ ...leadForm, name: event.target.value })} className="h-10 rounded-xl border border-white/10 bg-[#111827] px-3 text-sm" /><input required type="email" placeholder="Email" value={leadForm.email} onChange={(event) => setLeadForm({ ...leadForm, email: event.target.value })} className="h-10 rounded-xl border border-white/10 bg-[#111827] px-3 text-sm" /><input placeholder="Company" value={leadForm.company} onChange={(event) => setLeadForm({ ...leadForm, company: event.target.value })} className="h-10 rounded-xl border border-white/10 bg-[#111827] px-3 text-sm" /><select value={leadForm.status} onChange={(event) => setLeadForm({ ...leadForm, status: event.target.value as LeadStatus })} className="h-10 rounded-xl border border-white/10 bg-[#111827] px-3 text-sm"><option value="new">New</option><option value="valid">Valid</option><option value="contacted">Contacted</option><option value="converted">Converted</option></select><input placeholder="Website" value={leadForm.website} onChange={(event) => setLeadForm({ ...leadForm, website: event.target.value })} className="h-10 rounded-xl border border-white/10 bg-[#111827] px-3 text-sm" /><button disabled={pending} className="h-10 rounded-xl bg-cyan-500 text-sm font-black disabled:opacity-60">{editingId ? "Save Lead" : "Add Lead"}</button></form>{leadError && <p role="alert" className="text-sm text-rose-400">{leadError}</p>}<div className={`rounded-2xl border overflow-hidden ${dark ? "border-white/[0.08] bg-white/[0.02]" : "border-slate-200 bg-white shadow-sm"}`}>{leadRows.length === 0 ? <p className="p-6 text-sm text-slate-400">No leads yet.</p> : leadRows.map((lead) => <div key={lead.id} className="flex items-center justify-between gap-4 p-4 border-b border-white/10 last:border-0"><div><div className="text-sm font-bold">{lead.name}</div><div className="text-xs text-slate-400">{lead.email}{lead.company ? ` · ${lead.company}` : ""}</div></div><div className="flex items-center gap-2"><span className="text-xs text-slate-400 capitalize">{lead.status}</span><button onClick={() => editLead(lead)} className="text-xs text-cyan-400">Edit</button><button onClick={() => removeLead(lead.id)} className="text-xs text-rose-400">Delete</button></div></div>)}</div></div>}

            {activeTab === "leads" && <div className="space-y-2">{leadRows.map((lead) => <div key={lead.id} className={`rounded-xl border px-4 py-3 ${dark ? "border-white/[0.08] bg-white/[0.02]" : "border-slate-200 bg-white"}`}><div className="flex items-center justify-between"><div><span className="text-sm font-bold">{lead.email}</span><span className="ml-2 text-xs text-slate-400">{lead.validation_status}</span>{lead.validation_reason && <p className="text-xs text-slate-500">{lead.validation_reason}</p>}</div><div className="flex gap-2"><button onClick={() => void validateLead(lead.id)} className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold">{lead.validated_at ? "Revalidate" : "Validate"}</button><button onClick={() => void generateAiMessage(lead.id)} className="rounded-lg bg-purple-500 px-3 py-1.5 text-xs font-bold">Generate AI Message</button></div></div>{aiMessages[lead.id] && <textarea value={aiMessages[lead.id]} onChange={(event) => setAiMessages((current) => ({ ...current, [lead.id]: event.target.value }))} className="mt-3 min-h-24 w-full rounded-xl border border-white/10 bg-[#111827] p-3 text-sm" />}</div>)}</div>}
            {activeTab === "reviews" && <ReviewsPanel dark={dark} />}
            {activeTab !== "dashboard" && activeTab !== "leads" && activeTab !== "reviews" && <WorkspacePanels activeTab={activeTab} user={user} dark={dark} />}
          </div>
        </div>
        {logoutOpen && <div role="dialog" aria-modal="true" aria-labelledby="logout-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6" onClick={() => setLogoutOpen(false)}><div className={`w-full max-w-sm rounded-2xl border p-6 shadow-2xl ${dark ? "border-white/10 bg-[#111827]" : "border-slate-200 bg-white"}`} onClick={(event) => event.stopPropagation()}><h2 id="logout-title" className="text-lg font-black">Are you sure you want to log out?</h2><div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setLogoutOpen(false)} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold">Cancel</button><form action="/api/auth/logout" method="post"><button type="submit" className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-black text-white">Logout</button></form></div></div></div>}
      </main>
    );
}
