import { NextRequest, NextResponse } from "next/server";
import {
  BillingUnavailableError,
  BillingSignatureError,
  parseStripeWebhook,
} from "@/lib/billing";
import { getServiceRoleConfig } from "@/lib/supabase-auth";

export const dynamic = "force-dynamic";

type StripeCheckoutSession = {
  id?: string;
  mode?: string;
  payment_status?: string;
  metadata?: Record<string, unknown>;
};

function text(value: unknown) {
  return typeof value === "string" && value
    ? value
    : null;
}

async function grantLimitBoost(userId: string) {
  const { url, key } = getServiceRoleConfig();

  const response = await fetch(
    `${url}/rest/v1/rpc/grant_limit_boost`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target_user_id: userId,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const body = await response.text();

    console.error(
      "ShareLite Limit Boost grant failed",
      {
        status: response.status,
        body: body.slice(0, 1000),
        userId,
      },
    );

    throw new Error(
      "Limit Boost activation failed.",
    );
  }

  return (await response.json()) === true;
}

export async function POST(
  request: NextRequest,
) {
  try {
    const payload = await request.text();

    const signature =
      request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        {
          error:
            "Missing Stripe signature.",
        },
        { status: 401 },
      );
    }

    const event = parseStripeWebhook(
      payload,
      signature,
    );

    /*
     * We only act on a completed Checkout session.
     *
     * Stripe signature verification happens inside
     * parseStripeWebhook(), so an unsigned/fake request
     * cannot reach the activation logic.
     */
    if (
      event.type !==
      "checkout.session.completed"
    ) {
      return NextResponse.json({
        received: true,
        ignored: true,
        eventType: event.type,
      });
    }

    const object =
      event.data?.object ?? {};

    const session =
      object as StripeCheckoutSession;

    const metadata =
      session.metadata ?? {};

    const purchaseType =
      text(metadata.purchase_type);

    /*
     * Normal subscription checkout is intentionally
     * ignored here. Existing subscription billing
     * remains handled by the subscription webhook flow.
     */
    if (
      purchaseType !==
      "limit_boost"
    ) {
      return NextResponse.json({
        received: true,
        ignored: true,
        reason:
          "Not a Limit Boost checkout.",
      });
    }

    /*
     * Limit Boost must be a one-time payment.
     */
    if (session.mode !== "payment") {
      return NextResponse.json(
        {
          error:
            "Invalid Limit Boost checkout mode.",
        },
        { status: 400 },
      );
    }

    /*
     * Only a paid Checkout session can activate
     * the boost.
     */
    if (
      session.payment_status !==
      "paid"
    ) {
      return NextResponse.json({
        received: true,
        pending: true,
        paymentStatus:
          session.payment_status ??
          null,
      });
    }

    const userId =
      text(metadata.user_id);

    if (!userId) {
      return NextResponse.json(
        {
          error:
            "Limit Boost checkout has no user ID.",
        },
        { status: 400 },
      );
    }

    /*
     * The database function itself prevents
     * duplicate active boosts for the same
     * subscription period.
     */
    const granted =
      await grantLimitBoost(userId);

    if (!granted) {
      /*
       * This can happen when:
       * - the subscription is not active/trialing
       * - an active boost already exists
       * - the database rejected the grant
       *
       * We return success to Stripe so it does
       * not endlessly retry the same payment event.
       */
      console.warn(
        "ShareLite Limit Boost was not granted.",
        {
          userId,
          stripeEventId: event.id,
          sessionId:
            session.id ?? null,
        },
      );

      return NextResponse.json({
        received: true,
        granted: false,
        duplicateOrNotEligible: true,
      });
    }

    console.log(
      "ShareLite Limit Boost activated.",
      {
        userId,
        stripeEventId: event.id,
        sessionId:
          session.id ?? null,
      },
    );

    return NextResponse.json({
      received: true,
      granted: true,
    });
  } catch (error) {
    if (
      error instanceof
      BillingSignatureError
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid Stripe signature.",
        },
        { status: 401 },
      );
    }

    if (
      error instanceof
      BillingUnavailableError
    ) {
      return NextResponse.json(
        {
          error:
            "Billing provider is not configured.",
        },
        { status: 503 },
      );
    }

    console.error(
      "ShareLite Stripe webhook error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Stripe webhook processing failed.",
      },
      { status: 500 },
    );
  }
}