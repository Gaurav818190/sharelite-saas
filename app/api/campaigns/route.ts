import { NextResponse } from "next/server";

import {
  createCampaign,
  deleteCampaign,
  getCampaign,
  listCampaigns,
  updateCampaign,
  type CampaignStatus,
} from "@/lib/supabase-workspaces";

import { requireAuthenticatedUser } from "@/lib/supabase-db";

import {
  getCurrentEntitlements,
  hasCapacity,
} from "@/lib/monetization";

export const dynamic = "force-dynamic";

const statuses: CampaignStatus[] = [
  "draft",
  "active",
  "paused",
  "completed",
];

function isUnauthenticated(error: unknown) {
  return (
    error instanceof Error &&
    error.message === "UNAUTHENTICATED"
  );
}

function parseCreateInput(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as Record<string, unknown>;

  if (
    typeof data.name !== "string" ||
    !data.name.trim() ||
    data.name.trim().length > 200
  ) {
    return null;
  }

  if (
    data.description !== undefined &&
    data.description !== null &&
    typeof data.description !== "string"
  ) {
    return null;
  }

  if (
    data.template_id !== undefined &&
    data.template_id !== null &&
    typeof data.template_id !== "string"
  ) {
    return null;
  }

  /*
   * New campaigns are always created as drafts.
   * Status is intentionally not accepted from the client.
   */
  return {
    name: data.name.trim(),
    description:
      typeof data.description === "string"
        ? data.description.trim() || null
        : null,
    status: "draft" as const,
    template_id:
      typeof data.template_id === "string"
        ? data.template_id.trim() || null
        : null,
  };
}

export async function GET() {
  try {
    const { accessToken } =
      await requireAuthenticatedUser();

    const campaigns =
      await listCampaigns(accessToken);

    return NextResponse.json({
      campaigns,
    });
  } catch (error) {
    const unauthenticated =
      isUnauthenticated(error);

    return NextResponse.json(
      {
        error: unauthenticated
          ? "Authentication required."
          : "Unable to load campaigns.",
      },
      {
        status: unauthenticated ? 401 : 500,
      },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user, accessToken } =
      await requireAuthenticatedUser();

    const body = await request
      .json()
      .catch(() => null);

    const data = parseCreateInput(body);

    if (!data) {
      return NextResponse.json(
        {
          error:
            "Invalid campaign data.",
        },
        { status: 400 },
      );
    }

    const entitlements =
      await getCurrentEntitlements(
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
        {
          error:
            "Campaign limit reached for your plan.",
        },
        { status: 403 },
      );
    }

    const campaign =
      await createCampaign(
        accessToken,
        user.id,
        data,
      );

    return NextResponse.json(
      {
        campaign,
      },
      { status: 201 },
    );
  } catch (error) {
    const unauthenticated =
      isUnauthenticated(error);

    return NextResponse.json(
      {
        error: unauthenticated
          ? "Authentication required."
          : "Unable to create campaign.",
      },
      {
        status: unauthenticated ? 401 : 500,
      },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { accessToken } =
      await requireAuthenticatedUser();

    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id || id.trim().length > 100) {
      return NextResponse.json(
        {
          error:
            "Campaign ID is required.",
        },
        { status: 400 },
      );
    }

    const body = await request
      .json()
      .catch(() => null);

    if (
      !body ||
      typeof body !== "object"
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid campaign update.",
        },
        { status: 400 },
      );
    }

    const raw =
      body as Record<string, unknown>;

    const campaign =
      await getCampaign(
        accessToken,
        id.trim(),
      );

    if (!campaign) {
      return NextResponse.json(
        {
          error:
            "Campaign not found.",
        },
        { status: 404 },
      );
    }

    /*
     * Completed campaigns are terminal.
     */
    if (campaign.status === "completed") {
      return NextResponse.json(
        {
          error:
            "Completed campaigns cannot be changed.",
        },
        { status: 409 },
      );
    }

    const updates: {
      name?: string;
      description?: string | null;
      template_id?: string | null;
      status?: CampaignStatus;
    } = {};

    /*
     * Name
     */
    if (raw.name !== undefined) {
      if (
        typeof raw.name !== "string" ||
        !raw.name.trim() ||
        raw.name.trim().length > 200
      ) {
        return NextResponse.json(
          {
            error:
              "Campaign name is required and must be 200 characters or less.",
          },
          { status: 400 },
        );
      }

      updates.name =
        raw.name.trim();
    }

    /*
     * Description
     */
    if (raw.description !== undefined) {
      if (
        raw.description !== null &&
        typeof raw.description !== "string"
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid campaign description.",
          },
          { status: 400 },
        );
      }

      updates.description =
        typeof raw.description === "string"
          ? raw.description.trim() || null
          : null;
    }

    /*
     * Template
     */
    if (raw.template_id !== undefined) {
      if (
        raw.template_id !== null &&
        (
          typeof raw.template_id !== "string" ||
          !raw.template_id.trim()
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid campaign template.",
          },
          { status: 400 },
        );
      }

      updates.template_id =
        typeof raw.template_id === "string"
          ? raw.template_id.trim()
          : null;
    }

    /*
     * Status
     */
    if (raw.status !== undefined) {
      if (
        typeof raw.status !== "string" ||
        !statuses.includes(
          raw.status as CampaignStatus,
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid campaign status.",
          },
          { status: 400 },
        );
      }

      const nextStatus =
        raw.status as CampaignStatus;

      /*
       * Clients cannot manually complete
       * campaigns.
       */
      if (nextStatus === "completed") {
        return NextResponse.json(
          {
            error:
              "Campaign completion is managed by the delivery system.",
          },
          { status: 409 },
        );
      }

      /*
       * Draft → Active
       * Paused → Active
       */
      if (nextStatus === "active") {
        if (
          campaign.status !== "draft" &&
          campaign.status !== "paused"
        ) {
          return NextResponse.json(
            {
              error:
                `Campaign cannot be activated from ${campaign.status}.`,
            },
            { status: 409 },
          );
        }

        const resultingTemplateId =
          updates.template_id !== undefined
            ? updates.template_id
            : campaign.template_id;

        if (!resultingTemplateId) {
          return NextResponse.json(
            {
              error:
                "Assign an outreach template before activating the campaign.",
            },
            { status: 409 },
          );
        }
      }

      /*
       * Active → Paused
       */
      if (nextStatus === "paused") {
        if (
          campaign.status !== "active"
        ) {
          return NextResponse.json(
            {
              error:
                `Only active campaigns can be paused. Current status: ${campaign.status}.`,
            },
            { status: 409 },
          );
        }
      }

      /*
       * Draft campaigns remain drafts.
       * No transition into draft is allowed.
       */
      if (
        nextStatus === "draft" &&
        campaign.status !== "draft"
      ) {
        return NextResponse.json(
          {
            error:
              "Only existing draft campaigns can remain in draft status.",
          },
          { status: 409 },
        );
      }

      updates.status =
        nextStatus;
    }

    /*
     * Prevent empty PATCH requests.
     */
    if (
      Object.keys(updates).length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "No campaign changes were provided.",
        },
        { status: 400 },
      );
    }

    /*
     * If activation is requested, the resulting
     * campaign must have a template.
     */
    if (
      updates.status === "active"
    ) {
      const resultingTemplateId =
        updates.template_id !== undefined
          ? updates.template_id
          : campaign.template_id;

      if (!resultingTemplateId) {
        return NextResponse.json(
          {
            error:
              "Assign an outreach template before activating the campaign.",
          },
          { status: 409 },
        );
      }
    }

    const updated =
      await updateCampaign(
        accessToken,
        id.trim(),
        updates,
      );

    if (!updated) {
      return NextResponse.json(
        {
          error:
            "Unable to update campaign.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      campaign: updated,
    });
  } catch (error) {
    console.error(
      "ShareLite campaign update failed:",
      error,
    );

    const unauthenticated =
      isUnauthenticated(error);

    return NextResponse.json(
      {
        error: unauthenticated
          ? "Authentication required."
          : "Unable to update campaign.",
      },
      {
        status: unauthenticated ? 401 : 500,
      },
    );
  }
}

export async function DELETE(
  request: Request,
) {
  try {
    const { accessToken } =
      await requireAuthenticatedUser();

    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id || id.trim().length > 100) {
      return NextResponse.json(
        {
          error:
            "Campaign ID is required.",
        },
        { status: 400 },
      );
    }

    const deleted =
      await deleteCampaign(
        accessToken,
        id.trim(),
      );

    if (!deleted) {
      return NextResponse.json(
        {
          error:
            "Campaign not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    const unauthenticated =
      isUnauthenticated(error);

    return NextResponse.json(
      {
        error: unauthenticated
          ? "Authentication required."
          : "Unable to delete campaign.",
      },
      {
        status: unauthenticated ? 401 : 500,
      },
    );
  }
}