import { NextResponse } from "next/server";

import {
  createCampaignDeliveries,
  getCampaign,
  listCampaignDeliveries,
  updateCampaignDelivery,
} from "@/lib/supabase-workspaces";

import {
  listLeads,
  requireAuthenticatedUser,
} from "@/lib/supabase-db";

type Context = {
  params: Promise<{ id: string }>;
};

type AiDraft = {
  subject: string;
  message: string;
};

function isUnauthenticated(error: unknown) {
  return (
    error instanceof Error &&
    error.message === "UNAUTHENTICATED"
  );
}

function parseLeadIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  if (value.length === 0 || value.length > 5000) {
    return null;
  }

  const normalized = value.map((id) => {
    if (
      typeof id !== "string" ||
      !id.trim() ||
      id.trim().length > 100
    ) {
      return null;
    }

    return id.trim();
  });

  if (normalized.some((id) => id === null)) {
    return null;
  }

  return [
    ...new Set(
      normalized.filter(
        (id): id is string => id !== null,
      ),
    ),
  ];
}

function parseAiDrafts(
  value: unknown,
): Record<string, AiDraft> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const source =
    value as Record<string, unknown>;

  const result: Record<string, AiDraft> = {};

  /*
   * Prevent an unnecessarily huge AI draft payload.
   */
  const entries = Object.entries(source)
    .slice(0, 5000);

  for (const [leadId, rawDraft] of entries) {
    if (
      !leadId ||
      leadId.length > 100 ||
      !rawDraft ||
      typeof rawDraft !== "object"
    ) {
      continue;
    }

    const draft =
      rawDraft as Record<string, unknown>;

    const subject =
      typeof draft.subject === "string"
        ? draft.subject.trim()
        : "";

    const message =
      typeof draft.message === "string"
        ? draft.message.trim()
        : "";

    if (
      !subject ||
      !message ||
      subject.length > 300 ||
      message.length > 20_000
    ) {
      continue;
    }

    result[leadId] = {
      subject,
      message,
    };
  }

  return result;
}

export async function POST(
  request: Request,
  context: Context,
) {
  try {
    const { user, accessToken } =
      await requireAuthenticatedUser();

    const { id: campaignId } =
      await context.params;

    if (
      !campaignId ||
      campaignId.trim().length > 100
    ) {
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
        campaignId.trim(),
      );

    if (!campaign) {
      return NextResponse.json(
        {
          error:
            "Campaign not found for your account.",
        },
        { status: 404 },
      );
    }

    if (!campaign.template_id) {
      return NextResponse.json(
        {
          error:
            "This campaign has no outreach template assigned.",
        },
        { status: 409 },
      );
    }

    /*
     * Deliveries should only be prepared for
     * campaigns that can actually be used.
     */
    if (
      campaign.status === "completed"
    ) {
      return NextResponse.json(
        {
          error:
            "Completed campaigns cannot receive new deliveries.",
        },
        { status: 409 },
      );
    }

    const requestBody =
      await request
        .json()
        .catch(() => null);

    if (
      !requestBody ||
      typeof requestBody !== "object"
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid campaign delivery request.",
        },
        { status: 400 },
      );
    }

    const body =
      requestBody as Record<string, unknown>;

    const leadIds =
      parseLeadIds(body.leadIds);

    if (!leadIds) {
      return NextResponse.json(
        {
          error:
            "A valid leadIds array with 1 to 5000 leads is required.",
        },
        { status: 400 },
      );
    }

    if (leadIds.length === 0) {
      return NextResponse.json(
        {
          error:
            "At least one lead is required.",
        },
        { status: 400 },
      );
    }

    const aiDrafts =
      parseAiDrafts(body.aiDrafts);

    const [
      allLeads,
      existingDeliveries,
    ] = await Promise.all([
      listLeads(accessToken),
      listCampaignDeliveries(
        accessToken,
        campaignId.trim(),
      ),
    ]);

    const requestedIds =
      new Set(leadIds);

    const selectedLeads =
      allLeads.filter((lead) =>
        requestedIds.has(lead.id),
      );

    if (selectedLeads.length === 0) {
      return NextResponse.json(
        {
          error:
            "The selected leads are no longer available in your account.",
          requestedLeadIds: leadIds,
        },
        { status: 404 },
      );
    }

    /*
     * Only leads whose email has passed
     * validation can enter the delivery queue.
     */
    const validLeads =
      selectedLeads.filter(
        (lead) =>
          lead.validation_status === "valid",
      );

    const invalidLeadCount =
      selectedLeads.length -
      validLeads.length;

    if (validLeads.length === 0) {
      return NextResponse.json(
        {
          error:
            "None of the selected leads has a valid verified email. Validate the leads before preparing the campaign.",
          requested: leadIds.length,
          validLeads: 0,
          invalidLeads:
            invalidLeadCount,
        },
        { status: 409 },
      );
    }

    const existingByLead =
      new Map(
        existingDeliveries.map(
          (delivery) => [
            delivery.lead_id,
            delivery,
          ],
        ),
      );

    /*
     * Create deliveries only for leads
     * that do not already have one.
     */
    const newRows =
      validLeads
        .filter(
          (lead) =>
            !existingByLead.has(
              lead.id,
            ),
        )
        .map((lead) => {
          const draft =
            aiDrafts[lead.id];

          return {
            campaign_id:
              campaignId.trim(),
            lead_id: lead.id,
            user_id: user.id,
            email_subject:
              draft?.subject ?? null,
            email_body:
              draft?.message ?? null,
          };
        });

    const created =
      newRows.length > 0
        ? await createCampaignDeliveries(
            accessToken,
            newRows,
          )
        : [];

    const updatedExisting = [];

    for (const lead of validLeads) {
      const delivery =
        existingByLead.get(
          lead.id,
        );

      if (!delivery) {
        continue;
      }

      const draft =
        aiDrafts[lead.id];

      /*
       * Failed deliveries can be prepared
       * again from scratch.
       */
      if (
        delivery.status === "failed"
      ) {
        const updated =
          await updateCampaignDelivery(
            accessToken,
            delivery.id,
            {
              status: "pending",
              email_subject:
                draft?.subject ??
                delivery.email_subject,
              email_body:
                draft?.message ??
                delivery.email_body,
              provider_message_id:
                null,
              provider_event_id:
                null,
              error_code: null,
              error_message:
                null,
              sent_at: null,
              delivered_at:
                null,
              bounced_at: null,
            },
          );

        if (updated) {
          updatedExisting.push(
            updated,
          );
        }

        continue;
      }

      /*
       * Pending deliveries can receive
       * an updated AI-generated draft.
       */
      if (
        delivery.status === "pending" &&
        draft
      ) {
        const updated =
          await updateCampaignDelivery(
            accessToken,
            delivery.id,
            {
              email_subject:
                draft.subject,
              email_body:
                draft.message,
            },
          );

        if (updated) {
          updatedExisting.push(
            updated,
          );
        }
      }

      /*
       * Sending, accepted, delivered and
       * bounced deliveries are not re-queued
       * by this preparation endpoint.
       */
    }

    const preparedDeliveries = [
      ...created,
      ...updatedExisting,
    ];

    const preparedCount =
      preparedDeliveries.length;

    const skippedExisting =
      Math.max(
        0,
        validLeads.length -
          preparedCount,
      );

    return NextResponse.json({
      success: true,
      campaignId:
        campaignId.trim(),
      requested:
        leadIds.length,
      selectedLeads:
        selectedLeads.length,
      validLeads:
        validLeads.length,
      invalidLeads:
        invalidLeadCount,
      created:
        created.length,
      updatedExisting:
        updatedExisting.length,
      skippedExisting,
      createdDeliveryIds:
        preparedDeliveries.map(
          (delivery) =>
            delivery.id,
        ),
      preparedDeliveries,
      status: "pending",
    });
  } catch (error) {
    console.error(
      "ShareLite prepare campaign delivery failed:",
      error,
    );

    return NextResponse.json(
      {
        error:
          isUnauthenticated(error)
            ? "Authentication required."
            : "Unable to prepare campaign deliveries.",
      },
      {
        status:
          isUnauthenticated(error)
            ? 401
            : 500,
      },
    );
  }
}

export async function GET(
  _request: Request,
  context: Context,
) {
  try {
    const { accessToken } =
      await requireAuthenticatedUser();

    const { id: campaignId } =
      await context.params;

    if (
      !campaignId ||
      campaignId.trim().length > 100
    ) {
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
        campaignId.trim(),
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

    const deliveries =
      await listCampaignDeliveries(
        accessToken,
        campaignId.trim(),
      );

    return NextResponse.json({
      campaignId:
        campaignId.trim(),
      deliveries,
    });
  } catch (error) {
    const unauthenticated =
      isUnauthenticated(error);

    return NextResponse.json(
      {
        error:
          unauthenticated
            ? "Authentication required."
            : "Unable to load campaign deliveries.",
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