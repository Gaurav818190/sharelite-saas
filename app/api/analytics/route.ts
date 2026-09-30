import { NextResponse } from "next/server";

import {
  requireAuthenticatedUser,
  listLeads,
  type Lead,
} from "@/lib/supabase-db";

import {
  listCampaigns,
  listUserCampaignDeliveries,
  buildAnalytics,
} from "@/lib/supabase-workspaces";

import { getCurrentEntitlements } from "@/lib/monetization";

export const dynamic = "force-dynamic";

type AnalyticsRange =
  | "7d"
  | "30d"
  | "3m";

type ChangeResult = {
  current: number;
  previous: number;
  percentage: number | null;
};

type DeliveryLifecycle = {
  pending: number;
  sending: number;
  accepted: number;
  delivered: number;
  bounced: number;
  failed: number;
  total: number;
  deliveryRate: number;
  bounceRate: number;
};

function getDays(
  range: string | null,
): number {
  return range === "3m"
    ? 90
    : range === "30d"
    ? 30
    : 7;
}

function getDateKey(
  date: Date,
): string {
  return date.toISOString().slice(0, 10);
}

function isWithinRange(
  createdAt: string,
  startDate: Date,
  endDate: Date,
): boolean {
  const timestamp =
    new Date(createdAt).getTime();

  if (!Number.isFinite(timestamp)) {
    return false;
  }

  return (
    timestamp >= startDate.getTime() &&
    timestamp < endDate.getTime()
  );
}

function calculateChange(
  current: number,
  previous: number,
): ChangeResult {
  if (previous === 0) {
    return {
      current,
      previous,
      percentage:
        current === 0
          ? 0
          : null,
    };
  }

  return {
    current,
    previous,
    percentage: Math.round(
      ((current - previous) /
        previous) *
        100,
    ),
  };
}

function countLeadStatuses(
  leads: Lead[],
  startDate: Date,
  endDate: Date,
) {
  const filteredLeads =
    leads.filter((lead) =>
      isWithinRange(
        lead.created_at,
        startDate,
        endDate,
      ),
    );

  return {
    total: filteredLeads.length,
    valid: filteredLeads.filter(
      (lead) =>
        lead.status === "valid",
    ).length,
    contacted:
      filteredLeads.filter(
        (lead) =>
          lead.status === "contacted",
      ).length,
    converted:
      filteredLeads.filter(
        (lead) =>
          lead.status === "converted",
      ).length,
  };
}

function buildDeliveryLifecycle(
  deliveries: Array<{
    status: string;
  }>,
): DeliveryLifecycle {
  const result = {
    pending: 0,
    sending: 0,
    accepted: 0,
    delivered: 0,
    bounced: 0,
    failed: 0,
  };

  for (const delivery of deliveries) {
    if (
      delivery.status in result
    ) {
      const key =
        delivery.status as keyof typeof result;

      result[key] += 1;
    }
  }

  const total =
    deliveries.length;

  const deliveryRate =
    total > 0
      ? Math.round(
          (result.delivered /
            total) *
            100,
        )
      : 0;

  const bounceRate =
    total > 0
      ? Math.round(
          (result.bounced /
            total) *
            100,
        )
      : 0;

  return {
    ...result,
    total,
    deliveryRate,
    bounceRate,
  };
}

export async function GET(
  request: Request,
) {
  try {
    const {
      user,
      accessToken,
    } =
      await requireAuthenticatedUser();

    const rangeParam =
      new URL(request.url).searchParams.get(
        "range",
      );

    const range: AnalyticsRange =
      rangeParam === "3m" ||
      rangeParam === "30d" ||
      rangeParam === "7d"
        ? rangeParam
        : "7d";

    const days =
      getDays(range);

    const [
      leads,
      campaigns,
      deliveries,
      entitlements,
    ] = await Promise.all([
      listLeads(accessToken),
      listCampaigns(accessToken),
      listUserCampaignDeliveries(
        accessToken,
        user.id,
      ),
      getCurrentEntitlements(
        accessToken,
        user.id,
      ),
    ]);

    const today =
      new Date();

    today.setUTCHours(
      0,
      0,
      0,
      0,
    );

    const currentStart =
      new Date(today);

    currentStart.setUTCDate(
      currentStart.getUTCDate() -
        days +
        1,
    );

    const previousStart =
      new Date(currentStart);

    previousStart.setUTCDate(
      previousStart.getUTCDate() -
        days,
    );

    const currentEnd =
      new Date(today);

    currentEnd.setUTCDate(
      currentEnd.getUTCDate() +
        1,
    );

    const currentCounts =
      countLeadStatuses(
        leads,
        currentStart,
        currentEnd,
      );

    const previousCounts =
      countLeadStatuses(
        leads,
        previousStart,
        currentStart,
      );

    const changes = {
      total: calculateChange(
        currentCounts.total,
        previousCounts.total,
      ),

      valid: calculateChange(
        currentCounts.valid,
        previousCounts.valid,
      ),

      contacted: calculateChange(
        currentCounts.contacted,
        previousCounts.contacted,
      ),

      converted: calculateChange(
        currentCounts.converted,
        previousCounts.converted,
      ),
    };

    const performance =
      Array.from(
        { length: days },
        (_, index) => {
          const date =
            new Date(today);

          date.setUTCDate(
            today.getUTCDate() -
              (days - 1 - index),
          );

          const key =
            getDateKey(date);

          return {
            date: key,

            leads:
              leads.filter(
                (lead) =>
                  lead.created_at.slice(
                    0,
                    10,
                  ) === key,
              ).length,

            campaigns:
              campaigns.filter(
                (campaign) =>
                  campaign.created_at.slice(
                    0,
                    10,
                  ) === key,
              ).length,
          };
        },
      );

    const deliveryLifecycle =
      buildDeliveryLifecycle(
        deliveries,
      );

    return NextResponse.json({
      analytics:
        buildAnalytics(
          leads,
          campaigns,
        ),

      performance,

      changes,

      deliveryLifecycle,

      usage:
        entitlements.usage,

      limits:
        entitlements.limits,

      plan:
        entitlements.plan,

      range,
    });
  } catch (error) {
    const unauthenticated =
      error instanceof Error &&
      error.message ===
        "UNAUTHENTICATED";

    return NextResponse.json(
      {
        error: unauthenticated
          ? "Authentication required."
          : "Unable to load analytics.",
      },
      {
        status:
          unauthenticated
            ? 401
            : 500,
      },
    );
  }
}