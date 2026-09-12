import { NextResponse } from "next/server";
import { applySubscriptionEvent, BillingSignatureError, BillingUnavailableError, parseStripeWebhook, subscriptionEventData } from "@/lib/billing";

export async function POST(request: Request) {
  try {
    const signature = request.headers.get("stripe-signature");
    if (!signature) return NextResponse.json({ error: "Webhook signature required." }, { status: 400 });
    const event = parseStripeWebhook(await request.text(), signature);
    const relevant = new Set(["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "invoice.payment_failed"]);
    if (relevant.has(event.type)) await applySubscriptionEvent(subscriptionEventData(event));
    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof BillingUnavailableError) return NextResponse.json({ error: "Billing webhook is not configured." }, { status: 503 });
    if (error instanceof BillingSignatureError || error instanceof SyntaxError) return NextResponse.json({ error: "Invalid webhook." }, { status: 400 });
    return NextResponse.json({ error: "Unable to process webhook." }, { status: 500 });
  }
}
