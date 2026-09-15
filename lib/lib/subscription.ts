import { getCurrentSession, getConfig } from "@/lib/supabase-auth";

export type SubscriptionPlan =
  | "free"
  | "starter"
  | "pro"
  | "business";

export type UserSubscription = {
  plan: SubscriptionPlan;
  status: string;
  trialUsed: boolean;
  currentPeriodEnd: string | null;
  isActive: boolean;
};

export async function getCurrentSubscription(): Promise<UserSubscription | null> {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  const { url, key } = getConfig();

  const response = await fetch(
    `${url}/rest/v1/subscriptions?user_id=eq.${session.user.id}&select=plan,status,trial_used,current_period_end&limit=1`,
    {
      method: "GET",
      headers: {
        apikey: key,
        Authorization: `Bearer ${session.accessToken}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return null;
  }

  const rows = await response.json();
  const subscription = rows?.[0];

  if (!subscription) {
    return null;
  }

  const hasValidPlan = [
    "free",
    "starter",
    "pro",
    "business",
  ].includes(subscription.plan);

  if (!hasValidPlan) {
    return null;
  }

  const isActive =
    ["active", "trialing"].includes(subscription.status) &&
    (subscription.current_period_end === null ||
      new Date(subscription.current_period_end).getTime() > Date.now());

  return {
    plan: subscription.plan as SubscriptionPlan,
    status: subscription.status,
    trialUsed: Boolean(subscription.trial_used),
    currentPeriodEnd: subscription.current_period_end,
    isActive,
  };
}