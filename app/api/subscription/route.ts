import { NextResponse } from "next/server";
import {
  requireAuthenticatedUser,
} from "@/lib/supabase-db";
import {
  getCurrentEntitlements,
  getSubscription,
} from "@/lib/monetization";

export const dynamic = "force-dynamic";

const PERMANENT_FREE_EMAILS = new Set([
  "sunderkasana629@gmail.com",
]);

function isPermanentFreeEmail(email: string | null | undefined) {
  if (!email) {
    return false;
  }

  return PERMANENT_FREE_EMAILS.has(
    email.trim().toLowerCase(),
  );
}

function getRestUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not configured.",
    );
  }

  return `${url}/rest/v1`;
}

async function getActiveLimitBoost(
  accessToken: string,
  userId: string,
) {
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!apiKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured.",
    );
  }

  const response = await fetch(
    `${getRestUrl()}/limit_boosts?user_id=eq.${encodeURIComponent(
      userId,
    )}&status=eq.active&boosted_period_end=gt.${encodeURIComponent(
      new Date().toISOString(),
    )}&select=id,period_start,original_period_end,boosted_period_end,status,created_at&order=created_at.desc&limit=1`,
    {
      method: "GET",
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const body = await response.text();

    console.error(
      "ShareLite limit boost lookup failed",
      {
        status: response.status,
        body: body.slice(0, 1000),
      },
    );

    throw new Error("Unable to load limit boost.");
  }

  const rows = (await response.json()) as Array<{
    id: string;
    period_start: string;
    original_period_end: string;
    boosted_period_end: string;
    status: "active" | "expired" | "canceled";
    created_at: string;
  }>;

  return rows[0] ?? null;
}

export async function GET() {
  try {
    const { user, accessToken } =
      await requireAuthenticatedUser();

    const permanentFree = isPermanentFreeEmail(
      user.email,
    );

    const [
      subscription,
      entitlements,
      activeLimitBoost,
    ] = await Promise.all([
      getSubscription(
        accessToken,
        user.id,
      ),

      getCurrentEntitlements(
        accessToken,
        user.id,
      ),

      getActiveLimitBoost(
        accessToken,
        user.id,
      ),
    ]);

    const trialEndsAt =
      permanentFree
        ? null
        : subscription.status === "trialing"
          ? subscription.current_period_end
          : null;

    return NextResponse.json({
      subscription,
      trialEndsAt,
      permanentFree,
      entitlements,

      limitBoost: {
        active: Boolean(activeLimitBoost),

        id:
          activeLimitBoost?.id ??
          null,

        periodStart:
          activeLimitBoost?.period_start ??
          null,

        originalPeriodEnd:
          activeLimitBoost?.original_period_end ??
          null,

        boostedPeriodEnd:
          activeLimitBoost?.boosted_period_end ??
          null,

        status:
          activeLimitBoost?.status ??
          null,
      },
    });
  } catch (error) {
    const unauthenticated =
      error instanceof Error &&
      error.message === "UNAUTHENTICATED";

    console.error(
      "ShareLite subscription API error",
      error,
    );

    return NextResponse.json(
      {
        error: unauthenticated
          ? "Authentication required."
          : "Unable to load subscription.",
      },
      {
        status: unauthenticated ? 401 : 500,
      },
    );
  }
}