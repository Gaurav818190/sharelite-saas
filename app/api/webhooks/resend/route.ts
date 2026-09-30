import { NextResponse } from "next/server";
import {
  applySubscriptionEvent,
  parseRazorpayWebhook,
  parsePayPalWebhook,
  verifyPayPalWebhook,
} from "@/lib/billing";

export const dynamic = "force-dynamic";

const RAZORPAY_EVENTS = new Set([
  "subscription.authenticated",
  "subscription.activated",
  "subscription.charged",
  "subscription.pending",
  "subscription.halted",
  "subscription.paused",
  "subscription.resumed",
  "subscription.cancelled",
  "subscription.completed",
]);

const PAYPAL_EVENTS = new Set([
  "BILLING.SUBSCRIPTION.ACTIVATED",
  "BILLING.SUBSCRIPTION.UPDATED",
  "BILLING.SUBSCRIPTION.SUSPENDED",
  "BILLING.SUBSCRIPTION.CANCELLED",
  "BILLING.SUBSCRIPTION.EXPIRED",
  "PAYMENT.SALE.COMPLETED",
  "PAYMENT.CAPTURE.COMPLETED",
]);

export async function POST(request: Request) {
  try {
    const payload = await request.text();

    if (!payload) {
      return NextResponse.json(
        { error: "Empty webhook payload." },
        { status: 400 },
      );
    }

    /*
     * ----------------------------------------------------------------------
     * Razorpay
     * ----------------------------------------------------------------------
     */
    const razorpaySignature =
      request.headers.get(
        "x-razorpay-signature",
      );

    if (razorpaySignature) {
      const razorpayEventId =
        request.headers.get(
          "x-razorpay-event-id",
        );

      const parsed = parseRazorpayWebhook(
        payload,
        razorpaySignature,
        razorpayEventId,
      );

      const rawEvent = JSON.parse(payload) as {
        event?: string;
      };

      if (
        !rawEvent.event ||
        !RAZORPAY_EVENTS.has(rawEvent.event)
      ) {
        return NextResponse.json({
          received: true,
          ignored: true,
          provider: "razorpay",
        });
      }

      await applySubscriptionEvent(parsed);

      return NextResponse.json({
        received: true,
        provider: "razorpay",
      });
    }

    /*
     * ----------------------------------------------------------------------
     * PayPal
     * ----------------------------------------------------------------------
     */
    const paypalTransmissionId =
      request.headers.get(
        "paypal-transmission-id",
      );

    if (paypalTransmissionId) {
      await verifyPayPalWebhook(
        request,
        payload,
      );

      const rawEvent = JSON.parse(payload) as {
        event_type?: string;
      };

      if (
        !rawEvent.event_type ||
        !PAYPAL_EVENTS.has(
          rawEvent.event_type,
        )
      ) {
        return NextResponse.json({
          received: true,
          ignored: true,
          provider: "paypal",
        });
      }

      const parsed =
        parsePayPalWebhook(payload);

      await applySubscriptionEvent(parsed);

      return NextResponse.json({
        received: true,
        provider: "paypal",
      });
    }

    return NextResponse.json(
      {
        error:
          "Unknown billing webhook provider.",
      },
      { status: 400 },
    );
  } catch (error) {
    console.error(
      "ShareLite billing webhook error",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "";

    if (
      message ===
        "BILLING_SIGNATURE_INVALID"
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid webhook signature.",
        },
        { status: 400 },
      );
    }

    if (
      message ===
        "BILLING_PROVIDER_NOT_CONFIGURED"
    ) {
      return NextResponse.json(
        {
          error:
            "Billing provider is not configured.",
        },
        { status: 503 },
      );
    }

    /*
     * Returning 500 is intentional here.
     *
     * The provider can retry the webhook when
     * our database/RPC processing fails.
     */
    return NextResponse.json(
      {
        error:
          "Webhook processing failed.",
      },
      { status: 500 },
    );
  }
}