import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import { getServiceRoleConfig } from "@/lib/supabase-auth";
import type {
  Plan,
  SubscriptionStatus,
} from "@/lib/monetization";
import type {
  BillingPeriod,
  Currency,
} from "@/lib/pricing";

export class BillingUnavailableError extends Error {
  constructor() {
    super("BILLING_PROVIDER_NOT_CONFIGURED");
  }
}

export class BillingSignatureError extends Error {
  constructor() {
    super("BILLING_SIGNATURE_INVALID");
  }
}

export type NormalizedSubscriptionEvent = {
  eventId: string;
  provider: "razorpay" | "paypal";
  customerId: string | null;
  subscriptionId: string | null;
  userId: string | null;
  plan: Plan;
  status: SubscriptionStatus;
  periodStart: string | null;
  periodEnd: string | null;
};

type PaidPlan = Exclude<Plan, "free">;

const PAID_PLANS: PaidPlan[] = [
  "pro",
  "business",
  "scale",
  "enterprise",
  "yearly_unlimited",
  "ultimate_growth",
];

function isPaidPlan(value: unknown): value is PaidPlan {
  return (
    typeof value === "string" &&
    PAID_PLANS.includes(value as PaidPlan)
  );
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0
    ? value
    : null;
}

function unixToIso(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return new Date(value * 1000).toISOString();
}

function iso(value: unknown): string | null {
  return typeof value === "string" && value.length > 0
    ? value
    : null;
}

/* -------------------------------------------------------------------------- */
/* Razorpay                                                                   */
/* -------------------------------------------------------------------------- */

function razorpayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const webhookSecret =
    process.env.RAZORPAY_WEBHOOK_SECRET;

  return keyId && keySecret && webhookSecret
    ? {
        keyId,
        keySecret,
        webhookSecret,
      }
    : null;
}

function razorpayPlanId(
  plan: PaidPlan,
  billingPeriod: BillingPeriod,
) {
  const suffix =
    billingPeriod === "monthly" ? "MONTHLY" : "YEARLY";

  const envName = `RAZORPAY_${plan
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")}_${suffix}_PLAN_ID`;

  return process.env[envName];
}

function razorpayPlanFromId(
  planId: string | null,
): PaidPlan | null {
  if (!planId) {
    return null;
  }

  for (const plan of PAID_PLANS) {
    const monthly = razorpayPlanId(plan, "monthly");
    const yearly = razorpayPlanId(plan, "yearly");

    if (planId === monthly || planId === yearly) {
      return plan;
    }
  }

  return null;
}

function razorpayStatus(
  eventType: string,
  subscriptionStatus: unknown,
): SubscriptionStatus {
  const status = text(subscriptionStatus);

  if (
    eventType === "subscription.cancelled" ||
    eventType === "subscription.completed"
  ) {
    return "canceled";
  }

  if (
    eventType === "subscription.halted" ||
    eventType === "subscription.pending"
  ) {
    return "past_due";
  }

  if (status === "cancelled") {
    return "canceled";
  }

  if (
    status === "pending" ||
    status === "halted"
  ) {
    return "past_due";
  }

  if (status === "completed") {
    return "canceled";
  }

  return "active";
}

function verifyRazorpaySignature(
  payload: string,
  signature: string,
  secret: string,
) {
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  if (
    signature.length !== expected.length ||
    !timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected),
    )
  ) {
    throw new BillingSignatureError();
  }
}

export function parseRazorpayWebhook(
  payload: string,
  signature: string,
  eventIdHeader?: string | null,
): NormalizedSubscriptionEvent {
  const config = razorpayConfig();

  if (!config) {
    throw new BillingUnavailableError();
  }

  verifyRazorpaySignature(
    payload,
    signature,
    config.webhookSecret,
  );

  const event = JSON.parse(payload) as Record<
    string,
    unknown
  >;

  const eventType = text(event.event);

  if (!eventType) {
    throw new BillingSignatureError();
  }

  const payloadObject =
    event.payload &&
    typeof event.payload === "object"
      ? (event.payload as Record<string, unknown>)
      : {};

  const subscriptionContainer =
    payloadObject.subscription &&
    typeof payloadObject.subscription === "object"
      ? (payloadObject.subscription as Record<
          string,
          unknown
        >)
      : {};

  const subscription =
    subscriptionContainer.entity &&
    typeof subscriptionContainer.entity === "object"
      ? (subscriptionContainer.entity as Record<
          string,
          unknown
        >)
      : {};

  const notes =
    subscription.notes &&
    typeof subscription.notes === "object"
      ? (subscription.notes as Record<
          string,
          unknown
        >)
      : {};

  const subscriptionId = text(subscription.id);
  const planId = text(subscription.plan_id);

  const plan = razorpayPlanFromId(planId);

  const userId =
    text(notes.user_id) ??
    text(subscription.user_id);

  const customerId =
    text(subscription.customer_id);

  const periodStart =
    unixToIso(subscription.current_start);

  const periodEnd =
    unixToIso(subscription.current_end);

  return {
    eventId:
      text(eventIdHeader) ??
      createHash("sha256")
        .update(payload)
        .digest("hex"),
    provider: "razorpay",
    customerId,
    subscriptionId,
    userId,
    plan: plan ?? "free",
    status: razorpayStatus(
      eventType,
      subscription.status,
    ),
    periodStart,
    periodEnd,
  };
}

/* -------------------------------------------------------------------------- */
/* PayPal                                                                     */
/* -------------------------------------------------------------------------- */

function paypalConfig() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret =
    process.env.PAYPAL_CLIENT_SECRET;
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;

  const baseUrl =
    process.env.PAYPAL_ENV === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";

  return clientId && clientSecret && webhookId
    ? {
        clientId,
        clientSecret,
        webhookId,
        baseUrl,
      }
    : null;
}

function paypalPlanId(
  plan: PaidPlan,
  billingPeriod: BillingPeriod,
) {
  const suffix =
    billingPeriod === "monthly" ? "MONTHLY" : "YEARLY";

  const envName = `PAYPAL_${plan
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")}_${suffix}_PLAN_ID`;

  return process.env[envName];
}

function paypalPlanFromId(
  planId: string | null,
): PaidPlan | null {
  if (!planId) {
    return null;
  }

  for (const plan of PAID_PLANS) {
    const monthly = paypalPlanId(plan, "monthly");
    const yearly = paypalPlanId(plan, "yearly");

    if (planId === monthly || planId === yearly) {
      return plan;
    }
  }

  return null;
}

function paypalStatus(
  eventType: string,
  status: unknown,
): SubscriptionStatus {
  const value = text(status);

  if (
    eventType ===
      "BILLING.SUBSCRIPTION.CANCELLED" ||
    eventType ===
      "BILLING.SUBSCRIPTION.EXPIRED"
  ) {
    return "canceled";
  }

  if (
    eventType ===
    "BILLING.SUBSCRIPTION.SUSPENDED"
  ) {
    return "past_due";
  }

  if (
    value === "CANCELLED" ||
    value === "EXPIRED"
  ) {
    return "canceled";
  }

  if (value === "SUSPENDED") {
    return "past_due";
  }

  return "active";
}

async function getPayPalAccessToken() {
  const config = paypalConfig();

  if (!config) {
    throw new BillingUnavailableError();
  }

  const credentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
  ).toString("base64");

  const response = await fetch(
    `${config.baseUrl}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body:
        "grant_type=client_credentials",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("PayPal authentication failed.");
  }

  const data = (await response.json()) as {
    access_token?: string;
  };

  if (!data.access_token) {
    throw new Error("PayPal authentication failed.");
  }

  return data.access_token;
}

export async function verifyPayPalWebhook(
  request: Request,
  payload: string,
) {
  const config = paypalConfig();

  if (!config) {
    throw new BillingUnavailableError();
  }

  const transmissionId =
    request.headers.get(
      "paypal-transmission-id",
    );

  const transmissionTime =
    request.headers.get(
      "paypal-transmission-time",
    );

  const certUrl =
    request.headers.get("paypal-cert-url");

  const authAlgo =
    request.headers.get("paypal-auth-algo");

  const transmissionSig =
    request.headers.get(
      "paypal-transmission-sig",
    );

  if (
    !transmissionId ||
    !transmissionTime ||
    !certUrl ||
    !authAlgo ||
    !transmissionSig
  ) {
    throw new BillingSignatureError();
  }

  const accessToken =
    await getPayPalAccessToken();

  const response = await fetch(
    `${config.baseUrl}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transmission_id: transmissionId,
        transmission_time: transmissionTime,
        cert_url: certUrl,
        auth_algo: authAlgo,
        transmission_sig: transmissionSig,
        webhook_id: config.webhookId,
        webhook_event:
          JSON.parse(payload),
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new BillingSignatureError();
  }

  const result = (await response.json()) as {
    verification_status?: string;
  };

  if (
    result.verification_status !==
    "SUCCESS"
  ) {
    throw new BillingSignatureError();
  }
}

export function parsePayPalWebhook(
  payload: string,
): NormalizedSubscriptionEvent {
  const event = JSON.parse(payload) as Record<
    string,
    unknown
  >;

  const eventId = text(event.id);
  const eventType = text(event.event_type);

  if (!eventId || !eventType) {
    throw new BillingSignatureError();
  }

  const resource =
    event.resource &&
    typeof event.resource === "object"
      ? (event.resource as Record<
          string,
          unknown
        >)
      : {};

  const planId = text(resource.plan_id);

  const plan =
    paypalPlanFromId(planId);

  const billingInfo =
    resource.billing_info &&
    typeof resource.billing_info === "object"
      ? (resource.billing_info as Record<
          string,
          unknown
        >)
      : {};

  const subscriber =
    resource.subscriber &&
    typeof resource.subscriber === "object"
      ? (resource.subscriber as Record<
          string,
          unknown
        >)
      : {};

  const userId =
    text(resource.custom_id) ??
    text(subscriber.custom_id);

  const subscriptionId =
    text(resource.id) ??
    text(resource.billing_agreement_id);

  const customerId =
    text(subscriber.payer_id) ??
    text(resource.payer_id);

  const periodStart =
    iso(resource.start_time);

  const periodEnd =
    iso(
      billingInfo.next_billing_time,
    );

  return {
    eventId,
    provider: "paypal",
    customerId,
    subscriptionId,
    userId,
    plan: plan ?? "free",
    status: paypalStatus(
      eventType,
      resource.status,
    ),
    periodStart,
    periodEnd,
  };
}

/* -------------------------------------------------------------------------- */
/* Supabase billing event application                                         */
/* -------------------------------------------------------------------------- */

export async function applySubscriptionEvent(
  event: NormalizedSubscriptionEvent,
) {
  const { url, key } =
    getServiceRoleConfig();

  const response = await fetch(
    `${url}/rest/v1/rpc/apply_billing_subscription_event`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_event_id: event.eventId,
        p_provider: event.provider,
        p_customer_id: event.customerId,
        p_subscription_id:
          event.subscriptionId,
        p_user_id: event.userId,
        p_plan: event.plan,
        p_status: event.status,
        p_period_start:
          event.periodStart,
        p_period_end: event.periodEnd,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const body = await response.text();

    console.error(
      "ShareLite billing event processing failed",
      {
        status: response.status,
        body: body.slice(0, 1000),
      },
    );

    throw new Error(
      "Billing event processing failed.",
    );
  }

  return (await response.json()) === true;
}

/* -------------------------------------------------------------------------- */
/* Checkout                                                                   */
/* -------------------------------------------------------------------------- */

async function createRazorpaySubscription(
  userId: string,
  plan: PaidPlan,
  billingPeriod: BillingPeriod,
) {
  const config = razorpayConfig();

  if (!config) {
    throw new BillingUnavailableError();
  }

  const planId = razorpayPlanId(
    plan,
    billingPeriod,
  );

  if (!planId) {
    throw new BillingUnavailableError();
  }

  const response = await fetch(
    "https://api.razorpay.com/v1/subscriptions",
    {
      method: "POST",
      headers: {
        Authorization:
          `Basic ${Buffer.from(
            `${config.keyId}:${config.keySecret}`,
          ).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        plan_id: planId,
        customer_notify: 1,
        notes: {
          user_id: userId,
          plan,
          billing_period:
            billingPeriod,
          provider: "razorpay",
        },
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const body = await response.text();

    console.error(
      "Razorpay subscription creation failed",
      {
        status: response.status,
        body: body.slice(0, 1000),
      },
    );

    throw new Error(
      "Razorpay checkout failed.",
    );
  }

  const subscription =
    (await response.json()) as {
      short_url?: string;
    };

  if (!subscription.short_url) {
    throw new Error(
      "Razorpay checkout failed.",
    );
  }

  return subscription.short_url;
}

async function createPayPalSubscription(
  userId: string,
  plan: PaidPlan,
  billingPeriod: BillingPeriod,
) {
  const config = paypalConfig();
  const appUrl = process.env.APP_URL;

  if (!config || !appUrl) {
    throw new BillingUnavailableError();
  }

  const planId = paypalPlanId(
    plan,
    billingPeriod,
  );

  if (!planId) {
    throw new BillingUnavailableError();
  }

  const accessToken =
    await getPayPalAccessToken();

  const response = await fetch(
    `${config.baseUrl}/v1/billing/subscriptions`,
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        plan_id: planId,
        custom_id: userId,
        application_context: {
          brand_name: "ShareLite",
          user_action: "SUBSCRIBE_NOW",
          return_url:
            `${appUrl}/?billing=success`,
          cancel_url:
            `${appUrl}/?billing=canceled`,
        },
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const body = await response.text();

    console.error(
      "PayPal subscription creation failed",
      {
        status: response.status,
        body: body.slice(0, 1000),
      },
    );

    throw new Error(
      "PayPal checkout failed.",
    );
  }

  const subscription =
    (await response.json()) as {
      links?: Array<{
        rel?: string;
        href?: string;
      }>;
    };

  const approvalLink =
    subscription.links?.find(
      (link) =>
        link.rel === "approve",
    )?.href;

  if (!approvalLink) {
    throw new Error(
      "PayPal checkout failed.",
    );
  }

  return approvalLink;
}

export async function createCheckoutSession(
  userId: string,
  plan: PaidPlan,
  currency: Currency,
  billingPeriod: BillingPeriod,
) {
  if (
    plan === "yearly_unlimited" ||
    plan === "ultimate_growth"
  ) {
    if (billingPeriod !== "yearly") {
      throw new Error(
        "This plan is available annually only.",
      );
    }
  }

  if (currency === "INR") {
    return createRazorpaySubscription(
      userId,
      plan,
      billingPeriod,
    );
  }

  if (currency === "USD") {
    return createPayPalSubscription(
      userId,
      plan,
      billingPeriod,
    );
  }

  throw new BillingUnavailableError();
}

/* -------------------------------------------------------------------------- */
/* Legacy compatibility                                                       */
/* -------------------------------------------------------------------------- */

/*
 * Kept temporarily so any old Stripe webhook import does not break TypeScript.
 * Stripe is NOT used by the new checkout flow.
 */
export type BillingEvent = {
  id: string;
  type: string;
  data?: {
    object?: Record<string, unknown>;
  };
};

export function parseStripeWebhook(
  payload: string,
  _signature: string,
): BillingEvent {
  const event =
    JSON.parse(payload) as BillingEvent;

  if (!event.id || !event.type) {
    throw new BillingSignatureError();
  }

  throw new Error(
    "Stripe billing is no longer supported.",
  );
}

export function subscriptionEventData(
  event: BillingEvent,
): NormalizedSubscriptionEvent {
  const object =
    event.data?.object ?? {};

  const metadata =
    object.metadata &&
    typeof object.metadata === "object"
      ? (object.metadata as Record<
          string,
          unknown
        >)
      : {};

  return {
    eventId: event.id,
    provider: "razorpay",
    customerId: text(object.customer),
    subscriptionId: text(object.id),
    userId: text(metadata.user_id),
    plan: "free",
    status: "inactive",
    periodStart: null,
    periodEnd: null,
  };
}