import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/supabase-db";
import { getCurrentEntitlements, getSubscription } from "@/lib/monetization";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user, accessToken } = await requireAuthenticatedUser();
    const [subscription, entitlements] = await Promise.all([getSubscription(accessToken, user.id), getCurrentEntitlements(accessToken, user.id)]);
    const trialEndsAt = subscription.current_period_end;
    return NextResponse.json({ subscription, trialEndsAt, entitlements });
  } catch (error) {
    const unauthenticated = error instanceof Error && error.message === "UNAUTHENTICATED";
    return NextResponse.json({ error: unauthenticated ? "Authentication required." : "Unable to load subscription." }, { status: unauthenticated ? 401 : 500 });
  }
}
