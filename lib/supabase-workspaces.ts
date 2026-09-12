import { getConfig } from "@/lib/supabase-auth";
import type { Lead, LeadCounts, Profile } from "@/lib/supabase-db";

export type Template = { id: string; user_id: string; name: string; subject: string; body: string; created_at: string; updated_at: string };
export type TemplateInput = { name: string; subject: string; body: string };
export type CampaignStatus = "draft" | "active" | "paused" | "completed";
export type Campaign = { id: string; user_id: string; name: string; description: string | null; status: CampaignStatus; template_id: string | null; created_at: string; updated_at: string };
export type CampaignInput = { name: string; description?: string | null; status?: CampaignStatus; template_id?: string | null };
export type DeliveryStatus = "pending" | "sending" | "accepted" | "failed";
export type CampaignDelivery = { id: string; campaign_id: string; lead_id: string; user_id: string; status: DeliveryStatus; provider_message_id: string | null; error_code: string | null; error_message: string | null; sent_at: string | null; created_at: string; updated_at: string };

function restUrl() { return `${getConfig().url}/rest/v1`; }
async function request<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const { key } = getConfig();
  const response = await fetch(`${restUrl()}${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  if (!response.ok) {
    const body = await response.text();
    console.error("ShareLite Supabase workspace request failed", { path, status: response.status, body: body.slice(0, 1000) });
    throw new Error(`Database request failed (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function listTemplates(token: string) { return request<Template[]>(token, "/templates?select=*&order=created_at.desc"); }
export async function createTemplate(token: string, userId: string, input: TemplateInput) { const rows = await request<Template[]>(token, "/templates?select=*", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...input, user_id: userId }) }); return rows[0]; }
export async function getTemplate(token: string, id: string) { const rows = await request<Template[]>(token, `/templates?id=eq.${encodeURIComponent(id)}&select=*`); return rows[0] ?? null; }
export async function updateTemplate(token: string, id: string, input: Partial<TemplateInput>) { const rows = await request<Template[]>(token, `/templates?id=eq.${encodeURIComponent(id)}&select=*`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(input) }); return rows[0] ?? null; }
export async function deleteTemplate(token: string, id: string) { const rows = await request<{ id: string }[]>(token, `/templates?id=eq.${encodeURIComponent(id)}&select=id`, { method: "DELETE", headers: { Prefer: "return=representation" } }); return rows.length > 0; }

export async function listCampaigns(token: string) { return request<Campaign[]>(token, "/campaigns?select=*&order=created_at.desc"); }
export async function createCampaign(token: string, userId: string, input: CampaignInput) { const rows = await request<Campaign[]>(token, "/campaigns?select=*", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...input, user_id: userId }) }); return rows[0]; }
export async function getCampaign(token: string, id: string) { const rows = await request<Campaign[]>(token, `/campaigns?id=eq.${encodeURIComponent(id)}&select=*`); return rows[0] ?? null; }
export async function updateCampaign(token: string, id: string, input: Partial<CampaignInput>) { const rows = await request<Campaign[]>(token, `/campaigns?id=eq.${encodeURIComponent(id)}&select=*`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(input) }); return rows[0] ?? null; }
export async function deleteCampaign(token: string, id: string) { const rows = await request<{ id: string }[]>(token, `/campaigns?id=eq.${encodeURIComponent(id)}&select=id`, { method: "DELETE", headers: { Prefer: "return=representation" } }); return rows.length > 0; }
export async function listCampaignDeliveries(token: string, campaignId: string) { return request<CampaignDelivery[]>(token, `/campaign_deliveries?campaign_id=eq.${encodeURIComponent(campaignId)}&select=*&order=created_at.asc`); }
export async function createCampaignDelivery(token: string, input: { campaign_id: string; lead_id: string; user_id: string }) { const rows = await request<CampaignDelivery[]>(token, "/campaign_deliveries?select=*", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(input) }); return rows[0] ?? null; }
export async function updateCampaignDelivery(token: string, id: string, input: Partial<Pick<CampaignDelivery, "status" | "provider_message_id" | "error_code" | "error_message" | "sent_at">>) { const rows = await request<CampaignDelivery[]>(token, `/campaign_deliveries?id=eq.${encodeURIComponent(id)}&select=*`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(input) }); return rows[0] ?? null; }

export type Analytics = LeadCounts & { campaigns: number; campaignStatus: Record<CampaignStatus, number>; conversionRate: number; validationStatus: Record<"unknown" | "valid" | "invalid" | "risky" | "disposable" | "error", number> };
export function buildAnalytics(leads: Lead[], campaigns: Campaign[]): Analytics { const counts = { total: leads.length, valid: leads.filter((x) => x.status === "valid").length, contacted: leads.filter((x) => x.status === "contacted").length, converted: leads.filter((x) => x.status === "converted").length }; const validationStatus = { unknown: 0, valid: 0, invalid: 0, risky: 0, disposable: 0, error: 0 }; for (const lead of leads) validationStatus[lead.validation_status] += 1; return { ...counts, campaigns: campaigns.length, campaignStatus: { draft: campaigns.filter((x) => x.status === "draft").length, active: campaigns.filter((x) => x.status === "active").length, paused: campaigns.filter((x) => x.status === "paused").length, completed: campaigns.filter((x) => x.status === "completed").length }, validationStatus, conversionRate: counts.total ? Math.round((counts.converted / counts.total) * 10000) / 100 : 0 }; }

export async function updateProfile(token: string, userId: string, input: Pick<Profile, "name">) { const rows = await request<Profile[]>(token, `/profiles?id=eq.${encodeURIComponent(userId)}&select=*`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(input) }); return rows[0] ?? null; }
