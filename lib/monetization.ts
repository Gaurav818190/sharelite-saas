import { getConfig } from "@/lib/supabase-auth";
import { listLeads } from "@/lib/supabase-db";
import type { Lead } from "@/lib/supabase-db";
import { listCampaigns, listTemplates } from "@/lib/supabase-workspaces";
import type { Campaign, Template } from "@/lib/supabase-workspaces";

export type Plan = "free" | "starter" | "pro" | "business";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "inactive";

export type Feature =
  | "advancedAnalytics"
  | "bulkOutreach"
  | "automation"
  | "aiUsage";

export type PlanConfig = {
  label: string;
  limits: {
    leads: number;
    campaigns: number;
    templates: number;
    validation: number;
    aiUsage: number;
    emailSends: number;
  };
  features: Record<Feature, boolean>;
};

export const PLAN_CONFIG: Record<Plan, PlanConfig> = {
  free: {
    label: "Free",
    limits: {
      leads: 100,
      campaigns: 3,
      templates: 5,
      validation: 25,
      aiUsage: 10,
      emailSends: 25,
    },
    features: {
      advancedAnalytics: false,
      bulkOutreach: false,
      automation: false,
      aiUsage: true,
    },
  },

  starter: {
    label: "Starter",
    limits: {
      leads: 1000,
      campaigns: 10,
      templates: 25,
      validation: 500,
      aiUsage: 100,
      emailSends: 500,
    },
    features: {
      advancedAnalytics: true,
      bulkOutreach: true,
      automation: false,
      aiUsage: true,
    },
  },

  pro: {
    label: "Pro",
    limits: {
      leads: 10000,
      campaigns: 50,
      templates: 100,
      validation: 5000,
      aiUsage: 500,
      emailSends: 2500,
    },
    features: {
      advancedAnalytics: true,
      bulkOutreach: true,
      automation: true,
      aiUsage: true,
    },
  },

  business: {
    label: "Business",
    limits: {
      leads: 50000,
      campaigns: 200,
      templates: 500,
      validation: 25000,
      aiUsage: 2000,
      emailSends: 10000,
    },
    features: {
      advancedAnalytics: true,
      bulkOutreach: true,
      automation: true,
      aiUsage: true,
    },
  },
};

export type Subscription = {
  id: string;
  user_id: string;
  plan: Plan;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_used?: boolean;
  created_at: string;
  updated_at: string;
};

export type Usage = {
  leads: number;
  campaigns: number;
  templates: number;
  validation: number;
  aiUsage: number;
  emailSends: number;
};

function getRestUrl() {
  return `${getConfig().url}/rest/v1`;
}

async function request<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const { key } = getConfig();

  const response = await fetch(`${getRestUrl()}${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();

    console.error("ShareLite Supabase monetization request failed", {
      path,
      status: response.status,
      body: body.slice(0, 1000),
    });

    throw new Error(`Database request failed (${response.status}).`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function getSubscription(
  token: string,
  userId: string,
): Promise<Subscription> {
  const rows = await request<Subscription[]>(
    token,
    `/subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=*`,
  );

  return (
    rows[0] ?? {
      id: "",
      user_id: userId,
      plan: "free",
      status: "active",
      current_period_start: null,
      current_period_end: null,
      trial_used: true,
      created_at: "",
      updated_at: "",
    }
  );
}

export function getPlanConfig(plan: Plan) {
  return PLAN_CONFIG[plan];
}

export function canAccess(plan: Plan, feature: Feature) {
  return PLAN_CONFIG[plan].features[feature];
}

export function getUsage(
  leads: Lead[],
  campaigns: Campaign[],
  templates: Template[],
): Usage {
  return {
    leads: leads.length,
    campaigns: campaigns.length,
    templates: templates.length,
    validation: leads.filter((lead) => lead.validated_at !== null).length,
    aiUsage: 0,
    emailSends: 0,
  };
}

async function getCurrentPeriodUsage(
  token: string,
  base: Usage,
): Promise<Usage> {
  const periodStart = new Date().toISOString().slice(0, 10);

  const [aiRows, emailRows] = await Promise.all([
    request<Array<{ generation_count: number }>>(
      token,
      `/ai_usage?period_start=eq.${periodStart}&select=generation_count`,
    ),

    request<Array<{ send_count: number }>>(
      token,
      `/email_usage?period_start=eq.${periodStart}&select=send_count`,
    ),
  ]);

  return {
    ...base,
    aiUsage: aiRows[0]?.generation_count ?? 0,
    emailSends: emailRows[0]?.send_count ?? 0,
  };
}

export function getEntitlements(
  subscription: Subscription,
  usage: Usage,
) {
  const periodExpired =
    Boolean(subscription.current_period_end) &&
    new Date(subscription.current_period_end as string).getTime() <= Date.now();

  const subscriptionActive =
    subscription.status === "active" ||
    subscription.status === "trialing";

  const effectivePlan: Plan =
    !periodExpired && subscriptionActive ? subscription.plan : "free";

  const config = PLAN_CONFIG[effectivePlan];

  return {
    plan: effectivePlan,
    status: subscription.status,
    limits: config.limits,
    features: config.features,
    usage,

    remaining: {
      leads: Math.max(0, config.limits.leads - usage.leads),
      campaigns: Math.max(0, config.limits.campaigns - usage.campaigns),
      templates: Math.max(0, config.limits.templates - usage.templates),
      validation: Math.max(0, config.limits.validation - usage.validation),
      aiUsage: Math.max(0, config.limits.aiUsage - usage.aiUsage),
      emailSends: Math.max(
        0,
        config.limits.emailSends - usage.emailSends,
      ),
    },
  };
}

export function hasCapacity(
  plan: Plan,
  metric: keyof Usage,
  current: number,
) {
  return current < PLAN_CONFIG[plan].limits[metric];
}

export async function getCurrentEntitlements(
  token: string,
  userId: string,
) {
  const [subscription, leads, campaigns, templates] = await Promise.all([
    getSubscription(token, userId),
    listLeads(token),
    listCampaigns(token),
    listTemplates(token),
  ]);

  const baseUsage = getUsage(leads, campaigns, templates);
  const usage = await getCurrentPeriodUsage(token, baseUsage);

  return getEntitlements(subscription, usage);
}

export async function consumeAiGeneration(token: string) {
  const rows = await request<boolean[]>(
    token,
    "/rpc/consume_ai_generation",
    {
      method: "POST",
      body: "{}",
    },
  );

  return rows[0] === true;
}

export async function consumeEmailSend(token: string) {
  const rows = await request<boolean[]>(
    token,
    "/rpc/consume_email_send",
    {
      method: "POST",
      body: "{}",
    },
  );

  return rows[0] === true;
}