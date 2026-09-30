import { NextResponse } from "next/server";

import {
  deleteCampaign,
  getCampaign,
  updateCampaign,
  type CampaignStatus,
} from "@/lib/supabase-workspaces";

import { requireAuthenticatedUser } from "@/lib/supabase-db";

type Context = {
  params: Promise<{ id: string }>;
};

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

function parseUpdateInput(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const data = value as Record<string, unknown>;

  const result: {
    name?: string;
    description?: string | null;
    status?: CampaignStatus;
    template_id?: string | null;
  } = {};

  if (data.name !== undefined) {
    if (
      typeof data.name !== "string" ||
      !data.name.trim() ||
      data.name.trim().length > 200
    ) {
      return null;
    }

    result.name = data.name.trim();
  }

  if (data.description !== undefined) {
    if (
      data.description !== null &&
      typeof data.description !== "string"
    ) {
      return null;
    }

    result.description =
      typeof data.description === "string"
        ? data.description.trim() || null
        : null;
  }

  if (data.template_id !== undefined) {
    if (
      data.template_id !== null &&
      (
        typeof data.template_id !== "string" ||
        !data.template_id.trim()
      )
    ) {
      return null;
    }

    result.template_id =
      typeof data.template_id === "string"
        ? data.template_id.trim()
        : null;
  }

  if (data.status !== undefined) {
    if (
      typeof data.status !== "string" ||
      !statuses.includes(
        data.status as CampaignStatus,
      )
    ) {
      return null;
    }

    result.status =
      data.status as CampaignStatus;
  }

  if (Object.keys(result).length === 0) {
    return null;
  }

  return result;
}

function errorResponse(
  error: unknown,
  fallback: string,
) {
  const unauthenticated =
    isUnauthenticated(error);

  return NextResponse.json(
    {
      error: unauthenticated
        ? "Authentication required."
        : fallback,
    },
    {
      status: unauthenticated ? 401 : 500,
    },
  );
}

export async function GET(
  _request: Request,
  context: Context,
) {
  try {
    const { accessToken } =
      await requireAuthenticatedUser();

    const { id } = await context.params;

    if (!id?.trim()) {
      return NextResponse.json(
        {
          error:
            "Campaign ID is required.",
        },
        { status: 400 },
      );
    }

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

    return NextResponse.json({
      campaign,
    });
  } catch (error) {
    return errorResponse(
      error,
      "Unable to load campaign.",
    );
  }
}

export async function PATCH(
  request: Request,
  context: Context,
) {
  try {
    const { accessToken } =
      await requireAuthenticatedUser();

    const { id } = await context.params;

    if (!id?.trim()) {
      return NextResponse.json(
        {
          error:
            "Campaign ID is required.",
        },
        { status: 400 },
      );
    }

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

    const rawBody = await request
      .json()
      .catch(() => null);

    const updates =
      parseUpdateInput(rawBody);

    if (!updates) {
      return NextResponse.json(
        {
          error:
            "Invalid campaign update.",
        },
        { status: 400 },
      );
    }

    /*
     * Status transition rules.
     */
    if (updates.status !== undefined) {
      const nextStatus =
        updates.status;

      /*
       * Clients cannot manually complete campaigns.
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

        const templateId =
          updates.template_id !== undefined
            ? updates.template_id
            : campaign.template_id;

        if (!templateId) {
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
        if (campaign.status !== "active") {
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
       * Existing drafts remain drafts.
       * Other statuses cannot transition back to draft.
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
    }

    /*
     * Prevent removing a template while
     * activating a campaign.
     */
    if (updates.status === "active") {
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

    return errorResponse(
      error,
      "Unable to update campaign.",
    );
  }
}

export async function DELETE(
  _request: Request,
  context: Context,
) {
  try {
    const { accessToken } =
      await requireAuthenticatedUser();

    const { id } = await context.params;

    if (!id?.trim()) {
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

    return new NextResponse(null, {
      status: 204,
    });
  } catch (error) {
    return errorResponse(
      error,
      "Unable to delete campaign.",
    );
  }
}