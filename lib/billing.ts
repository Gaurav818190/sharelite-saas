import { createHmac, timingSafeEqual } from "node:crypto";
import { getConfig } from "@/lib/supabase-auth";
import type { Plan, SubscriptionStatus } from "@/lib/monetization";

export class BillingUnavailableError extends Error {
  constructor() { super("BILLING_PROVIDER_NOT_CONFIGURED"); }
}

export class BillingSignatureError extends Error {
  constructor() { super("BILLING_SIGNATURE_INVALID"); }
}

export type BillingEvent = {
  id: string;
  type: string;
  data?: { object?: Record<string, unknown> };
};

function stripeConfig() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  return secretKey && webhookSecret ? { secretKey, webhookSecret } : null;
}

function verifySignature(payload: string, signature: string, secret: string) {
  const parts = signature.split(",");
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0 || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) throw new BillingSignatureError();
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  if (!signatures.some((value) => value.length === expected.length && timingSafeEqual(Buffer.from(value), Buffer.from(expected)))) throw new BillingSignatureError();
}

export function parseStripeWebhook(payload: string, signature: string): BillingEvent {
  const config = stripeConfig();
  if (!config) throw new BillingUnavailableError();
  verifySignature(payload, signature, config.webhookSecret);
  const event = JSON.parse(payload) as BillingEvent;
  if (!event.id || !event.type) throw new BillingSignatureError();
  return event;
}

function text(value: unknown) { return typeof value === "string" && value ? value : null; }
function planFromPrice(priceId: string | null): Plan | null {
  if (priceId && priceId === process.env.STRIPE_PREMIUM_PRICE_ID) return "premium";
  if (priceId && priceId === process.env.STRIPE_PREMIUM_PRO_PRICE_ID) return "premium_pro";
  return null;
}

export function subscriptionEventData(event: BillingEvent) {
  const object = event.data?.object ?? {};
  const metadata = (object.metadata && typeof object.metadata === "object" ? object.metadata : {}) as Record<string, unknown>;
  const items = object.items && typeof object.items === "object" ? object.items as { data?: Array<{ price?: { id?: string } }> } : {};
  const priceId = text(items.data?.[0]?.price?.id) ?? text(object.price_id);
  const eventPlan = planFromPrice(priceId);
  const canceled = event.type.endsWith(".deleted") || object.cancel_at_period_end === true;
  const status = canceled ? "canceled" : text(object.status);
  const normalizedStatus: SubscriptionStatus = status === "trialing" || status === "past_due" || status === "canceled" || status === "inactive" ? status : "active";
  return {
    eventId: event.id,
    provider: "stripe",
    customerId: text(object.customer),
    subscriptionId: text(object.id),
    userId: text(metadata.user_id),
    plan: eventPlan ?? "free",
    status: normalizedStatus,
    periodStart: typeof object.current_period_start === "number" ? new Date(object.current_period_start * 1000).toISOString() : null,
    periodEnd: typeof object.current_period_end === "number" ? new Date(object.current_period_end * 1000).toISOString() : null,
  };
}

export async function applySubscriptionEvent(event: ReturnType<typeof subscriptionEventData>) {
  const { url, key } = getConfig();
  const response = await fetch(`${url}/rest/v1/rpc/apply_billing_subscription_event`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_event_id: event.eventId, p_provider: event.provider, p_customer_id: event.customerId, p_subscription_id: event.subscriptionId, p_user_id: event.userId, p_plan: event.plan, p_status: event.status, p_period_start: event.periodStart, p_period_end: event.periodEnd }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Billing event processing failed.");
  return (await response.json()) === true;
}

export async function createCheckoutSession(userId: string, plan: Exclude<Plan, "free">) {
  const config = stripeConfig();
  const priceId = plan === "premium" ? process.env.STRIPE_PREMIUM_PRICE_ID : process.env.STRIPE_PREMIUM_PRO_PRICE_ID;
  const appUrl = process.env.APP_URL;
  if (!config || !priceId || !appUrl) throw new BillingUnavailableError();
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ mode: "subscription", "line_items[0][price]": priceId, "line_items[0][quantity]": "1", success_url: `${appUrl}/?billing=success`, cancel_url: `${appUrl}/?billing=canceled`, "metadata[user_id]": userId, "subscription_data[metadata][user_id]": userId }).toString(),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Billing checkout failed.");
  const session = await response.json() as { url?: string };
  if (!session.url) throw new Error("Billing checkout failed.");
  return session.url;
}
