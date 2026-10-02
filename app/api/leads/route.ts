import { NextResponse } from "next/server";

import {
  countLeads,
  createLead,
  listLeads,
  requireAuthenticatedUser,
  type LeadInput,
  type LeadStatus,
} from "@/lib/supabase-db";

import {
  getCurrentEntitlements,
  hasCapacity,
} from "@/lib/monetization";

export const dynamic = "force-dynamic";

const statuses: LeadStatus[] = [
  "new",
  "valid",
  "contacted",
  "converted",
];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const countryCodePattern = /^[A-Z]{2}$/;

function getCountryName(countryCode: string): string | null {
  try {
    const displayNames = new Intl.DisplayNames(["en"], {
      type: "region",
    });

    return displayNames.of(countryCode) ?? null;
  } catch {
    return null;
  }
}

function parseInput(value: unknown): LeadInput | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const body = value as Record<string, unknown>;

  const name =
    typeof body.name === "string"
      ? body.name.trim()
      : "";

  const email =
    typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : "";

  const company =
    typeof body.company === "string"
      ? body.company.trim()
      : "";

  const status =
    typeof body.status === "string" &&
    statuses.includes(body.status as LeadStatus)
      ? (body.status as LeadStatus)
      : "new";

  const rawCountryCode =
    typeof body.country_code === "string"
      ? body.country_code.trim().toUpperCase()
      : "";

  const countryCode =
    rawCountryCode && countryCodePattern.test(rawCountryCode)
      ? rawCountryCode
      : null;

  let countryName =
    typeof body.country_name === "string"
      ? body.country_name.trim()
      : "";

  if (countryCode && !countryName) {
    countryName = getCountryName(countryCode) ?? "";
  }

  if (
    !name ||
    name.length > 200 ||
    !emailPattern.test(email) ||
    email.length > 320 ||
    !company ||
    company.length > 200 ||
    countryName.length > 120
  ) {
    return null;
  }

  return {
    name,
    email,
    company,

    website:
      typeof body.website === "string"
        ? body.website.trim() || null
        : null,

    status,

    source:
      typeof body.source === "string"
        ? body.source.trim() || null
        : null,

    country_code: countryCode,
    country_name: countryName || null,
  };
}

export async function GET() {
  try {
    const { accessToken } =
      await requireAuthenticatedUser();

    const leads = await listLeads(accessToken);

    return NextResponse.json({
      leads,
      counts: countLeads(leads),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "UNAUTHENTICATED"
    ) {
      return NextResponse.json(
        {
          error: "Authentication required.",
        },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        error: "Unable to load leads.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const input = parseInput(
    await request.json().catch(() => null),
  );

  if (!input) {
    return NextResponse.json(
      {
        error:
          "Name, valid email, company name, and valid lead data are required.",
      },
      { status: 400 },
    );
  }

  try {
    const { user, accessToken } =
      await requireAuthenticatedUser();

    const [leads, entitlements] =
      await Promise.all([
        listLeads(accessToken),
        getCurrentEntitlements(
          accessToken,
          user.id,
        ),
      ]);

    if (
      !hasCapacity(
        entitlements.plan,
        "leads",
        leads.length,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Lead limit reached for your plan.",
        },
        { status: 403 },
      );
    }

    const lead = await createLead(
      accessToken,
      user.id,
      input,
    );

    return NextResponse.json(
      { lead },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "UNAUTHENTICATED"
    ) {
      return NextResponse.json(
        {
          error: "Authentication required.",
        },
        { status: 401 },
      );
    }

    console.error(
      "ShareLite lead creation failed",
      error,
    );

    return NextResponse.json(
      {
        error: "Unable to create lead.",
      },
      { status: 500 },
    );
  }
}
