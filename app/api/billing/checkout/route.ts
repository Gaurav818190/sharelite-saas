import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/supabase-db";
import { createCheckoutSession } from "@/lib/billing";
import type { Currency, BillingPeriod } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const PAID_PLANS = new Set([
  "pro",
  "business",
  "scale",
  "enterprise",
  "yearly_unlimited",
  "ultimate_growth",
]);

type CheckoutBody = {
  plan?: string;
  currency?: Currency;
  billingPeriod?: BillingPeriod;
  boost?: boolean;
};

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();

    let body: CheckoutBody = {};

    try {
      body = (await request.json()) as CheckoutBody;
    } catch {
      body = {};
    }

    if (body.boost === true) {
      return NextResponse.json(
        {
          error: "Limit Boost payment is not configured yet.",
        },
        { status: 501 }
      );
    }

    const plan = typeof body.plan === "string" ? body.plan : "";

    if (!PAID_PLANS.has(plan)) {
      return NextResponse.json(
        {
          error: "Invalid plan.",
        },
        { status: 400 }
      );
    }

    const currency: Currency =
      body.currency === "INR" || body.currency === "USD"
        ? body.currency
        : "USD";

    const billingPeriod: BillingPeriod =
      body.billingPeriod === "yearly"
        ? "yearly"
        : "monthly";

    const checkoutUrl = await createCheckoutSession(
      user.id,
      plan as Parameters<typeof createCheckoutSession>[1],
      currency,
      billingPeriod
    );

    return NextResponse.json({
      url: checkoutUrl,
      plan,
      currency,
      billingPeriod,
    });
  } catch (error) {
    const unauthenticated =
      error instanceof Error &&
      error.message === "UNAUTHENTICATED";

    console.error("ShareLite checkout API error", error);

    return NextResponse.json(
      {
        error: unauthenticated
          ? "Authentication required."
          : "Unable to create checkout session.",
      },
      {
        status: unauthenticated ? 401 : 500,
      }
    );
  }
}