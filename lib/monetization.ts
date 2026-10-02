import { getConfig } from "@/lib/supabase-auth";
import { listLeads } from "@/lib/supabase-db";
import type { Lead } from "@/lib/supabase-db";
import {
  listCampaigns,
  listTemplates,
} from "@/lib/supabase-workspaces";
import type {
  Campaign,
  Template,
} from "@/lib/supabase-workspaces";

export type Plan =
  | "free"
  | "pro"
  | "business"
  | "scale"
  | "enterprise"
  | "yearly_unlimited"
  | "ultimate_growth";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "inactive";

export type Feature =
  | "advancedAnalytics"
  | "geoAnalytics"
  | "bulkOutreach"
  | "automation"
  | "aiUsage"
  | "aiIcebreakers"
  | "hyperPersonalization"
  | "imagePersonalization"
  | "timeZoneScheduling"
  | "abTesting"
  | "advancedSecurity"
  | "whiteLabel"
  | "multiClientWorkspace"
  | "advancedApi"
  | "dedicatedSupport";

export type PlanConfig = {
  label: string;
  billing: "free" | "monthly" | "yearly";
  limits: {
    leads: number;
    campaigns: number;
    templates: number;
    validation: number;
    aiUsage: number;
    emailSends: number;
    campaignEmails: number;
    inboxes: number;
  };
  features: Record<Feature, boolean>;
};

const BASE_FEATURES: Record<Feature, boolean> = {
  advancedAnalytics: true,
  geoAnalytics: true,
  bulkOutreach: true,
  automation: true,
  aiUsage: true,
  aiIcebreakers: false,
  hyperPersonalization: false,
  imagePersonalization: false,
  timeZoneScheduling: false,
  abTesting: false,
  advancedSecurity: false,
  whiteLabel: false,
  multiClientWorkspace: false,
  advancedApi: false,
  dedicatedSupport: false,
};

export const PLAN_CONFIG: Record<Plan, PlanConfig> = {
  free: {
    label: "Free",
    billing: "free",
    limits: {
      leads: 100,
      campaigns: 3,
      templates: 5,
      validation: 25,
      aiUsage: 10,
      emailSends: 250,
      campaignEmails: 25,
      inboxes: 1,
    },
    features: {
      ...BASE_FEATURES,
      advancedAnalytics: false,
      bulkOutreach: false,
      automation: false,
    },
  },

  pro: {
    label: "Pro",
    billing: "monthly",
    limits: {
      leads: 2500,
      campaigns: 50,
      templates: 100,
      validation: 2000,
      aiUsage: 500,
      emailSends: 1500,
      campaignEmails: 100,
      inboxes: 10,
    },
    features: {
      ...BASE_FEATURES,
      advancedAnalytics: true,
        geoAnalytics: true,
      bulkOutreach: true,
      automation: true,
      aiUsage: true,
    },
  },

  business: {
    label: "Business",
    billing: "monthly",
    limits: {
      leads: 5000,
      campaigns: 200,
      templates: 500,
      validation: 5000,
      aiUsage: 2000,
      emailSends: 3000,
      campaignEmails: 250,
      inboxes: 25,
    },
    features: {
      ...BASE_FEATURES,
      aiIcebreakers: true,
      advancedAnalytics: true,
        geoAnalytics: true,
      bulkOutreach: true,
      automation: true,
    },
  },

  scale: {
    label: "Scale",
    billing: "monthly",
    limits: {
      leads: 10000,
      campaigns: 350,
      templates: 750,
      validation: 7500,
      aiUsage: 5000,
      emailSends: 4500,
      campaignEmails: 500,
      inboxes: 50,
    },
    features: {
      ...BASE_FEATURES,
      aiIcebreakers: true,
      hyperPersonalization: true,
      imagePersonalization: true,
      timeZoneScheduling: true,
      abTesting: true,
      advancedSecurity: true,
      advancedAnalytics: true,
      bulkOutreach: true,
      automation: true,
    },
  },

  enterprise: {
    label: "Enterprise",
    billing: "monthly",
    limits: {
      leads: 20000,
      campaigns: 500,
      templates: 1000,
      validation: 10000,
      aiUsage: 10000,
      emailSends: 6000,
      campaignEmails: 1000,
      inboxes: 100,
    },
    features: {
      ...BASE_FEATURES,
      aiIcebreakers: true,
      hyperPersonalization: true,
      imagePersonalization: true,
      timeZoneScheduling: true,
      abTesting: true,
      advancedSecurity: true,
      whiteLabel: true,
      multiClientWorkspace: true,
      advancedApi: true,
      dedicatedSupport: true,
      advancedAnalytics: true,
        geoAnalytics: true,
      bulkOutreach: true,
      automation: true,
    },
  },

  yearly_unlimited: {
    label: "Yearly Unlimited",
    billing: "yearly",
    limits: {
      leads: 50000,
      campaigns: 1000,
      templates: 2000,
      validation: 25000,
      aiUsage: 10000,
      emailSends: 20000,
      campaignEmails: 2000,
      inboxes: 999999,
    },
    features: {
      ...BASE_FEATURES,
      aiIcebreakers: true,
      hyperPersonalization: true,
      imagePersonalization: true,
      timeZoneScheduling: true,
      abTesting: true,
      advancedSecurity: true,
      multiClientWorkspace: true,
      advancedApi: true,
      dedicatedSupport: true,
      advancedAnalytics: true,
        geoAnalytics: true,
      bulkOutreach: true,
      automation: true,
    },
  },

  ultimate_growth: {
    label: "Ultimate Growth Agency & Enterprise Scale",
    billing: "yearly",
    limits: {
      leads: 100000,
      campaigns: 2000,
      templates: 5000,
      validation: 30000,
      aiUsage: 10000,
      emailSends: 25000,
      campaignEmails: 2500,
      inboxes: 999999,
    },
    features: {
      ...BASE_FEATURES,
      aiIcebreakers: true,
      hyperPersonalization: true,
      imagePersonalization: true,
      timeZoneScheduling: true,
      abTesting: true,
      advancedSecurity: true,
      multiClientWorkspace: true,
      advancedApi: true,
      dedicatedSupport: true,
      advancedAnalytics: true,
        geoAnalytics: true,
      bulkOutreach: true,
      automation: true,
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
    `/subscriptions?user_id=eq.${encodeURIComponent(
      userId,
    )}&select=*`,
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

export function canAccess(
  plan: Plan,
  feature: Feature,
) {
  return PLAN_CONFIG[plan].features[feature];
}

export function getCampaignEmailLimit(plan: Plan) {
  return PLAN_CONFIG[plan].limits.campaignEmails;
}

export function getRecommendedPlanForCampaignSize(
  selectedCount: number,
): Plan | null {
  if (selectedCount <= 25) {
    return null;
  }

  if (selectedCount <= 100) {
    return "pro";
  }

  if (selectedCount <= 250) {
    return "business";
  }

  if (selectedCount <= 500) {
    return "scale";
  }

  if (selectedCount <= 1000) {
    return "enterprise";
  }

  return null;
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
    validation: 0,
    aiUsage: 0,
    emailSends: 0,
  };
}

async function getCurrentPeriodUsage(
  token: string,
  base: Usage,
  leads: Lead[],
): Promise<Usage> {
  const now = new Date();

  const periodStart = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      1,
    ),
  );

  const periodStartDate = periodStart
    .toISOString()
    .slice(0, 10);

  const [aiRows, emailRows] = await Promise.all([
    request<Array<{ generation_count: number }>>(
      token,
      `/ai_usage?period_start=eq.${periodStartDate}&select=generation_count`,
    ),

    request<Array<{ send_count: number }>>(
      token,
      `/email_usage?period_start=eq.${periodStartDate}&select=send_count`,
    ),
  ]);

  const validationUsage = leads.filter((lead) => {
    if (!lead.validated_at) {
      return false;
    }

    return (
      new Date(lead.validated_at).getTime() >=
      periodStart.getTime()
    );
  }).length;

  return {
    ...base,
    validation: validationUsage,
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
    new Date(
      subscription.current_period_end as string,
    ).getTime() <= Date.now();

  const subscriptionActive =
    subscription.status === "active" ||
    subscription.status === "trialing";

  const effectivePlan: Plan =
    !periodExpired && subscriptionActive
      ? subscription.plan
      : "free";

  const config = PLAN_CONFIG[effectivePlan];

  return {
    plan: effectivePlan,
    status: subscription.status,
    limits: config.limits,
    features: config.features,
    usage,

    remaining: {
      leads: Math.max(
        0,
        config.limits.leads - usage.leads,
      ),
      campaigns: Math.max(
        0,
        config.limits.campaigns - usage.campaigns,
      ),
      templates: Math.max(
        0,
        config.limits.templates - usage.templates,
      ),
      validation: Math.max(
        0,
        config.limits.validation - usage.validation,
      ),
      aiUsage: Math.max(
        0,
        config.limits.aiUsage - usage.aiUsage,
      ),
      emailSends: Math.max(
        0,
        config.limits.emailSends - usage.emailSends,
      ),
      inboxes: config.limits.inboxes,
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
  const [
    subscription,
    leads,
    campaigns,
    templates,
  ] = await Promise.all([
    getSubscription(token, userId),
    listLeads(token),
    listCampaigns(token),
    listTemplates(token),
  ]);

  const baseUsage = getUsage(
    leads,
    campaigns,
    templates,
  );

  const usage = await getCurrentPeriodUsage(
    token,
    baseUsage,
    leads,
  );

  return getEntitlements(
    subscription,
    usage,
  );
}

export async function consumeAiGeneration(
  token: string,
): Promise<boolean> {
  const result = await request<boolean>(
    token,
    "/rpc/consume_ai_generation",
    {
      method: "POST",
      body: "{}",
    },
  );

  return result === true;
}

export async function releaseAiGeneration(
  token: string,
): Promise<boolean> {
  const result = await request<boolean>(
    token,
    "/rpc/release_ai_generation",
    {
      method: "POST",
      body: "{}",
    },
  );

  return result === true;
}

export async function consumeEmailSend(
  token: string,
): Promise<boolean> {
  const result = await request<boolean>(
    token,
    "/rpc/consume_email_send",
    {
      method: "POST",
      body: "{}",
    },
  );

  return result === true;
}