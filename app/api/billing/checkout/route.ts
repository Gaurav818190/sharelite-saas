import { NextResponse } from "next/server";

import { requireAuthenticatedUser } from "@/lib/supabase-db";
import {
  checkRateLimit,
  getClientKey,
  rateLimitResponse,
} from "@/lib/rate-limit";
import {
  createCheckoutSession,
  BillingUnavailableError,
} from "@/lib/billing";
import type { Plan } from "@/lib/monetization";

const PAID_PLANS: Exclude<Plan, "free">[] = [
  "starter",
  "pro",
  "business",
  "enterprise",
];

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(
    getClientKey(request, "billing-checkout"),
    10,
  );

  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit);
  }

  try {
    const { user } = await requireAuthenticatedUser();

    const body = await request.json().catch(() => null);
    const plan = body?.plan;

    if (
      typeof plan !== "string" ||
      !PAID_PLANS.includes(plan as Exclude<Plan, "free">)
    ) {
      return NextResponse.json(
        { error: "A valid paid plan is required." },
        { status: 400 },
      );
    }

    const url = await createCheckoutSession(
      user.id,
      plan as Exclude<Plan, "free">,
    );

    return NextResponse.json({ url });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "UNAUTHENTICATED"
    ) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    if (error instanceof BillingUnavailableError) {
      return NextResponse.json(
        { error: "Billing is not configured." },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Unable to start checkout." },
      { status: 502 },
    );
  }
}