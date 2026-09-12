import { getConfig } from "@/lib/supabase-auth";
import { listLeads } from "@/lib/supabase-db";
import type { Lead } from "@/lib/supabase-db";
import { listCampaigns, listTemplates } from "@/lib/supabase-workspaces";
import type { Campaign, Template } from "@/lib/supabase-workspaces";

export type Plan = "free" | "premium" | "premium_pro";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "inactive";
export type Feature = "advancedAnalytics" | "bulkOutreach" | "automation" | "aiUsage";
export type PlanConfig = { label: string; limits: { leads: number; campaigns: number; templates: number; validation: number; aiUsage: number; emailSends: number }; features: Record<Feature, boolean> };

export const PLAN_CONFIG: Record<Plan, PlanConfig> = {
  free: { label: "Free", limits: { leads: 100, campaigns: 3, templates: 5, validation: 25, aiUsage: 5, emailSends: 25 }, features: { advancedAnalytics: false, bulkOutreach: false, automation: false, aiUsage: true } },
  premium: { label: "Premium", limits: { leads: 5000, campaigns: 25, templates: 100, validation: 5000, aiUsage: 100, emailSends: 5000 }, features: { advancedAnalytics: true, bulkOutreach: true, automation: false, aiUsage: true } },
  premium_pro: { label: "Premium Pro", limits: { leads: 25000, campaigns: 100, templates: 500, validation: 25000, aiUsage: 1000, emailSends: 25000 }, features: { advancedAnalytics: true, bulkOutreach: true, automation: true, aiUsage: true } },
};

export type Subscription = { id: string; user_id: string; plan: Plan; status: SubscriptionStatus; current_period_start: string | null; current_period_end: string | null; created_at: string; updated_at: string };
export type Usage = { leads: number; campaigns: number; templates: number; validation: number; aiUsage: number; emailSends: number };

function url() { return `${getConfig().url}/rest/v1`; }
async function request<T>(token: string, path: string, init?: RequestInit) {
  const { key } = getConfig();
  const response = await fetch(`${url()}${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  if (!response.ok) {
    const body = await response.text();
    console.error("ShareLite Supabase monetization request failed", { path, status: response.status, body: body.slice(0, 1000) });
    throw new Error(`Database request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}
export async function getSubscription(token: string, userId: string) { const rows = await request<Subscription[]>(token, `/subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=*`); return rows[0] ?? { id: "", user_id: userId, plan: "free", status: "active", current_period_start: null, current_period_end: null, created_at: "", updated_at: "" }; }
export function getPlanConfig(plan: Plan) { return PLAN_CONFIG[plan]; }
export function canAccess(plan: Plan, feature: Feature) { return PLAN_CONFIG[plan].features[feature]; }
export function getUsage(leads: Lead[], campaigns: Campaign[], templates: Template[]): Usage { return { leads: leads.length, campaigns: campaigns.length, templates: templates.length, validation: leads.filter((lead) => lead.validated_at !== null).length, aiUsage: 0, emailSends: 0 }; }

async function currentUsage(token: string, base: Usage): Promise<Usage> {
  const period = new Date().toISOString().slice(0, 10);
  const [aiRows, emailRows] = await Promise.all([
    request<Array<{ generation_count: number }>>(token, `/ai_usage?period_start=eq.${period}&select=generation_count`),
    request<Array<{ send_count: number }>>(token, `/email_usage?period_start=eq.${period}&select=send_count`),
  ]);
  return { ...base, aiUsage: aiRows[0]?.generation_count ?? 0, emailSends: emailRows[0]?.send_count ?? 0 };
}

export function getEntitlements(subscription: Subscription, usage: Usage) {
  const periodExpired = Boolean(subscription.current_period_end && new Date(subscription.current_period_end).getTime() <= Date.now());
  const effectivePlan = !periodExpired && (subscription.status === "active" || subscription.status === "trialing") ? subscription.plan : "free";
  const config = PLAN_CONFIG[effectivePlan];
  return { plan: effectivePlan, status: subscription.status, limits: config.limits, features: config.features, usage, remaining: { leads: Math.max(0, config.limits.leads - usage.leads), campaigns: Math.max(0, config.limits.campaigns - usage.campaigns), templates: Math.max(0, config.limits.templates - usage.templates), validation: Math.max(0, config.limits.validation - usage.validation), aiUsage: Math.max(0, config.limits.aiUsage - usage.aiUsage), emailSends: Math.max(0, config.limits.emailSends - usage.emailSends) } };
}
export function hasCapacity(plan: Plan, metric: keyof Usage, current: number) { return current < PLAN_CONFIG[plan].limits[metric]; }
export async function getCurrentEntitlements(token: string, userId: string) {
  const [subscription, leads, campaigns, templates] = await Promise.all([getSubscription(token, userId), listLeads(token), listCampaigns(token), listTemplates(token)]);
  const usage = await currentUsage(token, getUsage(leads, campaigns, templates));
  return getEntitlements(subscription, usage);
}

export async function consumeAiGeneration(token: string) {
  const rows = await request<boolean[]>(token, "/rpc/consume_ai_generation", { method: "POST", body: "{}" });
  return rows[0] === true;
}

export async function consumeEmailSend(token: string) {
  const rows = await request<boolean[]>(token, "/rpc/consume_email_send", { method: "POST", body: "{}" });
  return rows[0] === true;
}
