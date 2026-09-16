import { NextResponse } from "next/server";

import {
  createCampaign,
  deleteCampaign,
  listCampaigns,
  type CampaignStatus,
} from "@/lib/supabase-workspaces";

import { requireAuthenticatedUser } from "@/lib/supabase-db";

import { getCurrentEntitlements, hasCapacity } from "@/lib/monetization";

const statuses: CampaignStatus[] = [
  "draft",
  "active",
  "paused",
  "completed",
];

function input(value: unknown) {
  if (!value || typeof value !== "object") return null;

  const b = value as Record<string, unknown>;

  if (
    typeof b.name !== "string" ||
    !b.name.trim() ||
    b.name.trim().length > 200
  ) {
    return null;
  }

  if (
    b.description !== undefined &&
    b.description !== null &&
    typeof b.description !== "string"
  ) {
    return null;
  }

  if (
    b.status !== undefined &&
    (typeof b.status !== "string" ||
      !statuses.includes(b.status as CampaignStatus))
  ) {
    return null;
  }

  if (
    b.template_id !== undefined &&
    b.template_id !== null &&
    typeof b.template_id !== "string"
  ) {
    return null;
  }

  return {
    name: b.name.trim(),
    description:
      typeof b.description === "string"
        ? b.description.trim() || null
        : null,
    status: (b.status as CampaignStatus | undefined) ?? "draft",
    template_id:
      (b.template_id as string | null | undefined) ?? null,
  };
}

export async function GET() {
  try {
    const { accessToken } = await requireAuthenticatedUser();

    return NextResponse.json({
      campaigns: await listCampaigns(accessToken),
    });
  } catch (e) {
    const unauthenticated =
      e instanceof Error && e.message === "UNAUTHENTICATED";

    return NextResponse.json(
      {
        error: unauthenticated
          ? "Authentication required."
          : "Unable to load campaigns.",
      },
      { status: unauthenticated ? 401 : 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user, accessToken } = await requireAuthenticatedUser();

    const data = input(await request.json().catch(() => null));

    if (!data) {
      return NextResponse.json(
        { error: "Invalid campaign data." },
        { status: 400 },
      );
    }

    const entitlements = await getCurrentEntitlements(
      accessToken,
      user.id,
    );

    if (
      !hasCapacity(
        entitlements.plan,
        "campaigns",
        entitlements.usage.campaigns,
      )
    ) {
      return NextResponse.json(
        { error: "Campaign limit reached for your plan." },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        campaign: await createCampaign(accessToken, user.id, data),
      },
      { status: 201 },
    );
  } catch (e) {
    const unauthenticated =
      e instanceof Error && e.message === "UNAUTHENTICATED";

    return NextResponse.json(
      {
        error: unauthenticated
          ? "Authentication required."
          : "Unable to create campaign.",
      },
      { status: unauthenticated ? 401 : 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { accessToken } = await requireAuthenticatedUser();

    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id || id.length > 100) {
      return NextResponse.json(
        { error: "Campaign ID is required." },
        { status: 400 },
      );
    }

    const deleted = await deleteCampaign(accessToken, id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Campaign not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const unauthenticated =
      e instanceof Error && e.message === "UNAUTHENTICATED";

    return NextResponse.json(
      {
        error: unauthenticated
          ? "Authentication required."
          : "Unable to delete campaign.",
      },
      { status: unauthenticated ? 401 : 500 },
    );
  }
}