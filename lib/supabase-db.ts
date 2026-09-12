import { getConfig, getCurrentSession, type AuthUser } from "@/lib/supabase-auth";

export type Profile = {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadStatus = "new" | "valid" | "contacted" | "converted";

export type EmailValidationStatus = "unknown" | "valid" | "invalid" | "risky" | "disposable" | "error";

export type Lead = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  company: string | null;
  website: string | null;
  status: LeadStatus;
  source: string | null;
  validation_status: EmailValidationStatus;
  validation_reason: string | null;
  validated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadInput = {
  name: string;
  email: string;
  company?: string | null;
  website?: string | null;
  status?: LeadStatus;
  source?: string | null;
};

export type LeadCounts = {
  total: number;
  valid: number;
  contacted: number;
  converted: number;
};

function getRestUrl() {
  const { url } = getConfig();
  return `${url}/rest/v1`;
}

async function supabaseRequest<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const { key } = getConfig();
  const response = await fetch(`${getRestUrl()}${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text();
    console.error("ShareLite Supabase request failed", { path, status: response.status, body: body.slice(0, 1000) });
    throw new Error(`Database request failed (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function requireAuthenticatedUser(): Promise<{ user: AuthUser; accessToken: string }> {
  const session = await getCurrentSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

export async function getProfile(accessToken: string, userId: string) {
  const rows = await supabaseRequest<Profile[]>(accessToken, `/profiles?id=eq.${encodeURIComponent(userId)}&select=*`);
  return rows[0] ?? null;
}

export async function listLeads(accessToken: string) {
  return supabaseRequest<Lead[]>(accessToken, "/leads?select=*&order=created_at.desc");
}

export async function getLead(accessToken: string, leadId: string) {
  const rows = await supabaseRequest<Lead[]>(accessToken, `/leads?id=eq.${encodeURIComponent(leadId)}&select=*`);
  return rows[0] ?? null;
}

export async function createLead(accessToken: string, userId: string, input: LeadInput) {
  return supabaseRequest<Lead[]>(accessToken, "/leads?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...input, user_id: userId }),
  }).then((rows) => rows[0]);
}

export async function updateLead(accessToken: string, leadId: string, input: Partial<LeadInput>) {
  const rows = await supabaseRequest<Lead[]>(accessToken, `/leads?id=eq.${encodeURIComponent(leadId)}&select=*`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(input),
  });
  return rows[0] ?? null;
}

export async function updateLeadValidation(accessToken: string, leadId: string, status: EmailValidationStatus, reason: string) {
  const rows = await supabaseRequest<Lead[]>(accessToken, `/leads?id=eq.${encodeURIComponent(leadId)}&select=*`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ validation_status: status, validation_reason: reason, validated_at: new Date().toISOString() }),
  });
  return rows[0] ?? null;
}

export async function deleteLead(accessToken: string, leadId: string) {
  const rows = await supabaseRequest<Lead[]>(accessToken, `/leads?id=eq.${encodeURIComponent(leadId)}&select=id`, {
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  });
  return rows.length > 0;
}

export function countLeads(leads: Lead[]): LeadCounts {
  return {
    total: leads.length,
    valid: leads.filter((lead) => lead.status === "valid").length,
    contacted: leads.filter((lead) => lead.status === "contacted").length,
    converted: leads.filter((lead) => lead.status === "converted").length,
  };
}
