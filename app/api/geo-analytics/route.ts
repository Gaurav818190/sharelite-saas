import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/supabase-db";
import {
  getCurrentEntitlements,
  canAccess,
  type Plan,
} from "@/lib/monetization";
import { listLeads } from "@/lib/supabase-db";

type RangeKey = "today" | "7d" | "30d" | "custom";
type MetricKey = "leads" | "valid" | "contacted" | "converted";

type CountryStats = {
  code: string;
  name: string;
  leads: number;
  valid: number;
  contacted: number;
  converted: number;
};

function getRangeStart(
  range: RangeKey,
  customFrom?: string | null,
) {
  const now = new Date();

  if (range === "today") {
    return new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
      ),
    );
  }

  if (range === "7d") {
    return new Date(
      now.getTime() - 7 * 24 * 60 * 60 * 1000,
    );
  }

  if (range === "30d") {
    return new Date(
      now.getTime() - 30 * 24 * 60 * 60 * 1000,
    );
  }

  if (range === "custom" && customFrom) {
    const parsed = new Date(customFrom);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function getMetricValue(
  country: CountryStats,
  metric: MetricKey,
) {
  return country[metric];
}

export async function GET(request: Request) {
  try {
    const { user, accessToken } =
      await requireAuthenticatedUser();

    const url = new URL(request.url);

    const range =
      (url.searchParams.get("range") as RangeKey | null) ??
      "30d";

    const metric =
      (url.searchParams.get("metric") as MetricKey | null) ??
      "leads";

    const customFrom =
      url.searchParams.get("from");

    const customTo =
      url.searchParams.get("to");

    const validRanges: RangeKey[] = [
      "today",
      "7d",
      "30d",
      "custom",
    ];

    const validMetrics: MetricKey[] = [
      "leads",
      "valid",
      "contacted",
      "converted",
    ];

    if (!validRanges.includes(range)) {
      return NextResponse.json(
        {
          error: "Invalid date range.",
        },
        { status: 400 },
      );
    }

    if (!validMetrics.includes(metric)) {
      return NextResponse.json(
        {
          error: "Invalid metric.",
        },
        { status: 400 },
      );
    }

    if (range === "custom" && !customFrom) {
      return NextResponse.json(
        {
          error:
            "Custom range requires a from date.",
        },
        { status: 400 },
      );
    }

    const entitlements =
      await getCurrentEntitlements(
        accessToken,
        user.id,
      );

    const plan = entitlements.plan as Plan;

    if (!canAccess(plan, "geoAnalytics")) {
      return NextResponse.json(
        {
          error: "Geo Analytics is not available on your plan.",
          code: "GEO_ANALYTICS_LOCKED",
          plan,
        },
        { status: 403 },
      );
    }

    const rangeStart = getRangeStart(
      range,
      customFrom,
    );

    const rangeEnd =
      range === "custom" && customTo
        ? new Date(customTo)
        : new Date();

    const leads = await listLeads(
      accessToken,
    );

    const filteredLeads = leads.filter((lead) => {
      const createdAt = new Date(
        lead.created_at,
      ).getTime();

      if (Number.isNaN(createdAt)) {
        return false;
      }

      if (
        rangeStart &&
        createdAt < rangeStart.getTime()
      ) {
        return false;
      }

      if (
        range === "custom" &&
        customTo &&
        createdAt > rangeEnd.getTime()
      ) {
        return false;
      }

      return true;
    });

    const countryMap =
      new Map<string, CountryStats>();

    for (const lead of filteredLeads) {
      const code =
        lead.country_code?.trim().toUpperCase();

      if (!code || !/^[A-Z]{2}$/.test(code)) {
        continue;
      }

      const name =
        lead.country_name?.trim() ||
        code;

      const existing =
        countryMap.get(code);

      if (existing) {
        existing.leads += 1;

        if (
          lead.status === "valid" ||
          lead.validation_status === "valid"
        ) {
          existing.valid += 1;
        }

        if (lead.status === "contacted") {
          existing.contacted += 1;
        }

        if (lead.status === "converted") {
          existing.converted += 1;
        }

        continue;
      }

      countryMap.set(code, {
        code,
        name,
        leads: 1,
        valid:
          lead.status === "valid" ||
          lead.validation_status === "valid"
            ? 1
            : 0,
        contacted:
          lead.status === "contacted"
            ? 1
            : 0,
        converted:
          lead.status === "converted"
            ? 1
            : 0,
      });
    }

    const countries =
      Array.from(countryMap.values()).sort(
        (a, b) =>
          getMetricValue(b, metric) -
          getMetricValue(a, metric),
      );

    const topCountries =
      countries.slice(0, 10).map(
        (country, index) => ({
          rank: index + 1,
          ...country,
        }),
      );

    const totals = countries.reduce(
      (result, country) => ({
        leads:
          result.leads + country.leads,
        valid:
          result.valid + country.valid,
        contacted:
          result.contacted +
          country.contacted,
        converted:
          result.converted +
          country.converted,
      }),
      {
        leads: 0,
        valid: 0,
        contacted: 0,
        converted: 0,
      },
    );

    return NextResponse.json({
      range,
      metric,
      userId: user.id,
      totals,
      countries,
      topCountries,
      totalCountries: countries.length,
      hasGeoData: countries.length > 0,
    });
  } catch (error) {
    console.error(
      "Geo Analytics API failed",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load Geo Analytics.",
      },
      { status: 500 },
    );
  }
}