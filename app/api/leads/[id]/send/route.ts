import { NextResponse } from "next/server";

import {
  getCampaign,
  getCampaignDelivery,
  getTemplate,
  updateCampaignDelivery,
} from "@/lib/supabase-workspaces";

import {
  getLead,
  requireAuthenticatedUser,
} from "@/lib/supabase-db";

import {
  checkRateLimit,
  getClientKey,
  rateLimitResponse,
} from "@/lib/rate-limit";

import { consumeEmailSend } from "@/lib/monetization";

import {
  EmailProviderRateLimitError,
  EmailProviderTemporaryError,
  EmailProviderUnavailableError,
  isEmailProviderConfigured,
  sendEmail,
} from "@/lib/email-sending";

type Context = {
  params: Promise<{ id: string }>;
};

type SendInput = {
  deliveryId: string;
  subject?: string;
  message?: string;
};

function parseInput(value: unknown): SendInput | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const body = value as Record<string, unknown>;

  const deliveryId =
    typeof body.deliveryId === "string"
      ? body.deliveryId.trim()
      : "";

  if (!deliveryId || deliveryId.length > 100) {
    return null;
  }

  const subject =
    typeof body.subject === "string"
      ? body.subject.trim()
      : undefined;

  const message =
    typeof body.message === "string"
      ? body.message.trim()
      : undefined;

  if (subject !== undefined && subject.length > 300) {
    return null;
  }

  if (message !== undefined && message.length > 20000) {
    return null;
  }

  if (
    (subject !== undefined && subject.length === 0) ||
    (message !== undefined && message.length === 0)
  ) {
    return null;
  }

  if (
    (subject !== undefined && message === undefined) ||
    (subject === undefined && message !== undefined)
  ) {
    return null;
  }

  return {
    deliveryId,
    subject,
    message,
  };
}

function personalize(
  value: string,
  lead: {
    name: string;
    email: string;
    company?: string | null;
    website?: string | null;
  },
) {
  const trimmedName = lead.name.trim();

  const firstName =
    trimmedName.split(/\s+/)[0] ?? "";

  return value
    .replace(/\[First Name\]/gi, firstName)
    .replace(/\[Name\]/gi, lead.name)
    .replace(/\[Email\]/gi, lead.email)
    .replace(/\[Company\]/gi, lead.company ?? "")
    .replace(/\[Website\]/gi, lead.website ?? "");
}

export async function POST(
  request: Request,
  context: Context,
) {
  const rateLimit = checkRateLimit(
    getClientKey(request, "campaign-send"),
    20,
  );

  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit);
  }

  let accessToken = "";
  let deliveryId = "";

  try {
    const {
      user,
      accessToken: token,
    } = await requireAuthenticatedUser();

    accessToken = token;

    const { id: campaignId } =
      await context.params;

    if (!campaignId || campaignId.length > 100) {
      return NextResponse.json(
        {
          error: "Invalid campaign.",
        },
        { status: 400 },
      );
    }

    const input = parseInput(
      await request.json().catch(() => null),
    );

    if (!input) {
      return NextResponse.json(
        {
          error:
            "A valid deliveryId is required. Subject and message must be provided together when using an AI email.",
        },
        { status: 400 },
      );
    }

    deliveryId = input.deliveryId;

    const campaign = await getCampaign(
      accessToken,
      campaignId,
    );

    if (!campaign) {
      return NextResponse.json(
        {
          error: "Campaign not found.",
        },
        { status: 404 },
      );
    }

    if (campaign.user_id !== user.id) {
      return NextResponse.json(
        {
          error: "Campaign not found.",
        },
        { status: 404 },
      );
    }

    if (campaign.status !== "active") {
      return NextResponse.json(
        {
          error:
            "Campaign must be active before emails can be sent.",
        },
        { status: 409 },
      );
    }

    if (!campaign.template_id) {
      return NextResponse.json(
        {
          error:
            "Campaign has no outreach template.",
        },
        { status: 409 },
      );
    }

    const delivery =
      await getCampaignDelivery(
        accessToken,
        deliveryId,
      );

    if (
      !delivery ||
      delivery.campaign_id !== campaignId ||
      delivery.user_id !== user.id
    ) {
      return NextResponse.json(
        {
          error:
            "Campaign delivery not found.",
        },
        { status: 404 },
      );
    }

    if (delivery.status !== "pending") {
      return NextResponse.json(
        {
          error:
            `Delivery is already ${delivery.status}.`,
        },
        { status: 409 },
      );
    }

    const [lead, template] =
      await Promise.all([
        getLead(
          accessToken,
          delivery.lead_id,
        ),
        getTemplate(
          accessToken,
          campaign.template_id,
        ),
      ]);

    if (!lead) {
      return NextResponse.json(
        {
          error: "Lead not found.",
        },
        { status: 404 },
      );
    }

    if (lead.validation_status !== "valid") {
      return NextResponse.json(
        {
          error:
            "This lead email is not verified as valid. Validate the lead before sending.",
        },
        { status: 409 },
      );
    }

    if (!template) {
      return NextResponse.json(
        {
          error:
            "Outreach template not found.",
        },
        { status: 404 },
      );
    }

    /*
     * Final lightweight syntax check.
     * Full validation is already handled by the
     * lead validation endpoint.
     */
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        lead.email.trim(),
      )
    ) {
      return NextResponse.json(
        {
          error: "Lead email is invalid.",
        },
        { status: 400 },
      );
    }

    if (!isEmailProviderConfigured()) {
      return NextResponse.json(
        {
          error:
            "Email sending is not configured.",
        },
        { status: 503 },
      );
    }

    /*
     * Consume the plan-level email allowance
     * before sending.
     */
    const consumed =
      await consumeEmailSend(
        accessToken,
      );

    if (!consumed) {
      return NextResponse.json(
        {
          error:
            "Email sending limit reached for your plan.",
        },
        { status: 403 },
      );
    }

    /*
     * Lock the delivery into sending state
     * before calling the provider.
     */
    await updateCampaignDelivery(
      accessToken,
      deliveryId,
      {
        status: "sending",
        error_code: null,
        error_message: null,
      },
    );

    const usingAiEmail =
      Boolean(
        input.subject &&
          input.message,
      );

    const rawSubject = usingAiEmail
      ? input.subject!
      : template.subject;

    const rawMessage = usingAiEmail
      ? input.message!
      : template.body;

    /*
     * Personalization is applied to both
     * template and AI-generated content.
     */
    const subject = personalize(
      rawSubject,
      lead,
    );

    const text = personalize(
      rawMessage,
      lead,
    );

    const result = await sendEmail({
      to: lead.email.trim(),
      subject,
      text,
    });

    const updated =
      await updateCampaignDelivery(
        accessToken,
        deliveryId,
        {
          status: "accepted",
          provider_message_id:
            result.providerMessageId,
          sent_at:
            new Date().toISOString(),
          error_code: null,
          error_message: null,
        },
      );

    return NextResponse.json({
      success: true,
      campaignId,
      delivery: updated,
      provider: result.provider,
      providerMessageId:
        result.providerMessageId,
      contentSource: usingAiEmail
        ? "ai"
        : "template",
    });
  } catch (error) {
    if (
      accessToken &&
      deliveryId &&
      error instanceof
        EmailProviderRateLimitError
    ) {
      await updateCampaignDelivery(
        accessToken,
        deliveryId,
        {
          status: "failed",
          error_code:
            "provider_rate_limit",
          error_message:
            "Email provider rate limit reached.",
        },
      ).catch(() => null);
    } else if (
      accessToken &&
      deliveryId &&
      error instanceof
        EmailProviderTemporaryError
    ) {
      await updateCampaignDelivery(
        accessToken,
        deliveryId,
        {
          status: "failed",
          error_code:
            "provider_temporary",
          error_message:
            "Email provider is temporarily unavailable.",
        },
      ).catch(() => null);
    } else if (
      accessToken &&
      deliveryId &&
      error instanceof
        EmailProviderUnavailableError
    ) {
      await updateCampaignDelivery(
        accessToken,
        deliveryId,
        {
          status: "failed",
          error_code:
            "provider_unavailable",
          error_message:
            "Email sending is not configured.",
        },
      ).catch(() => null);
    } else if (
      accessToken &&
      deliveryId
    ) {
      await updateCampaignDelivery(
        accessToken,
        deliveryId,
        {
          status: "failed",
          error_code: "send_failed",
          error_message:
            "Unable to send email.",
        },
      ).catch(() => null);
    }

    if (
      error instanceof Error &&
      error.message === "UNAUTHENTICATED"
    ) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        { status: 401 },
      );
    }

    if (
      error instanceof
      EmailProviderRateLimitError
    ) {
      return NextResponse.json(
        {
          error:
            "Email provider rate limit reached. Try again later.",
        },
        { status: 429 },
      );
    }

    if (
      error instanceof
      EmailProviderTemporaryError
    ) {
      return NextResponse.json(
        {
          error:
            "Email provider is temporarily unavailable.",
        },
        { status: 503 },
      );
    }

    if (
      error instanceof
      EmailProviderUnavailableError
    ) {
      return NextResponse.json(
        {
          error:
            "Email sending is not configured.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Unable to send email.",
      },
      { status: 500 },
    );
  }
}