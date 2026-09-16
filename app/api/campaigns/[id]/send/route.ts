import { NextResponse } from "next/server";
import {
  requireAuthenticatedUser,
  updateLead,
  listLeads,
} from "@/lib/supabase-db";
import {
  checkRateLimit,
  getClientKey,
  rateLimitResponse,
} from "@/lib/rate-limit";
import {
  consumeEmailSend,
  getCurrentEntitlements,
} from "@/lib/monetization";
import {
  EmailProviderRateLimitError,
  EmailProviderTemporaryError,
  EmailProviderUnavailableError,
  isEmailProviderConfigured,
  sendEmail,
} from "@/lib/email-sending";
import {
  createCampaignDelivery,
  getCampaign,
  getTemplate,
  listCampaignDeliveries,
  updateCampaignDelivery,
} from "@/lib/supabase-workspaces";

type Context = {
  params: Promise<{ id: string }>;
};

function safeText(value: string, max: number) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

export async function POST(
  request: Request,
  context: Context,
) {
  const rateLimit = checkRateLimit(
    getClientKey(request, "campaign-send"),
    5,
  );

  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit);
  }

  try {
    const { user, accessToken } =
      await requireAuthenticatedUser();

    const { id } = await context.params;

    const campaign = await getCampaign(
      accessToken,
      id,
    );

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found." },
        { status: 404 },
      );
    }

    if (campaign.status !== "active") {
      return NextResponse.json(
        {
          error:
            "Only active campaigns can be sent.",
        },
        { status: 409 },
      );
    }

    if (!campaign.template_id) {
      return NextResponse.json(
        {
          error:
            "Campaign template is required.",
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

    const template = await getTemplate(
      accessToken,
      campaign.template_id,
    );

    if (!template) {
      return NextResponse.json(
        {
          error:
            "Campaign template not found.",
        },
        { status: 404 },
      );
    }

    const [
      leads,
      existing,
      entitlements,
    ] = await Promise.all([
      listLeads(accessToken),
      listCampaignDeliveries(
        accessToken,
        id,
      ),
      getCurrentEntitlements(
        accessToken,
        user.id,
      ),
    ]);

    const userLeads = leads.filter(
      (lead) =>
        lead.user_id === user.id &&
        lead.validation_status === "valid" &&
        lead.status !== "converted",
    );

    const sentLeadIds = new Set(
      existing
        .filter(
          (delivery) =>
            delivery.status === "accepted" ||
            delivery.status === "sending",
        )
        .map(
          (delivery) => delivery.lead_id,
        ),
    );

    const pendingLeads = userLeads.filter(
      (lead) =>
        !sentLeadIds.has(lead.id),
    );

    const campaignLimit =
      entitlements.limits.campaignEmails;

    const selectedCount =
      pendingLeads.length;

    if (selectedCount > campaignLimit) {
      const recommendedPlan =
        selectedCount <= 500
          ? "Pro"
          : selectedCount <= 1000
            ? "Business"
            : selectedCount <= 1500
              ? "Enterprise"
              : null;

      const upgradeMessage =
        recommendedPlan
          ? `Upgrade to ${recommendedPlan} to send up to ${
              recommendedPlan === "Pro"
                ? 500
                : recommendedPlan === "Business"
                  ? 1000
                  : 1500
            } emails per campaign.`
          : "Please split your campaign into batches of 1500 emails or fewer.";

      return NextResponse.json(
        {
          error: `Your ${entitlements.plan} plan allows up to ${campaignLimit} emails per campaign. You selected: ${selectedCount} emails. ${upgradeMessage}`,
          code: "CAMPAIGN_EMAIL_LIMIT_EXCEEDED",
          plan: entitlements.plan,
          allowed: campaignLimit,
          selected: selectedCount,
        },
        { status: 403 },
      );
    }

    const results: Array<{
      leadId: string;
      status: "accepted" | "failed";
      error?: string;
    }> = [];

    for (const lead of pendingLeads) {
      const delivery =
        await createCampaignDelivery(
          accessToken,
          {
            campaign_id: id,
            lead_id: lead.id,
            user_id: user.id,
          },
        );

      if (!delivery) {
        continue;
      }

      await updateCampaignDelivery(
        accessToken,
        delivery.id,
        {
          status: "sending",
        },
      );

      try {
        const hasEmailCapacity =
          await consumeEmailSend(
            accessToken,
          );

        if (!hasEmailCapacity) {
          await updateCampaignDelivery(
            accessToken,
            delivery.id,
            {
              status: "failed",
              error_code:
                "QUOTA_EXCEEDED",
              error_message:
                "Monthly email sending limit reached.",
            },
          );

          results.push({
            leadId: lead.id,
            status: "failed",
            error:
              "Monthly email sending limit reached.",
          });

          break;
        }

        const result = await sendEmail({
          to: lead.email,
          subject: safeText(
            template.subject,
            200,
          ),
          text: safeText(
            template.body,
            50000,
          ),
        });

        await updateCampaignDelivery(
          accessToken,
          delivery.id,
          {
            status: "accepted",
            provider_message_id:
              result.providerMessageId,
            sent_at:
              new Date().toISOString(),
          },
        );

        await updateLead(
          accessToken,
          lead.id,
          {
            status: "contacted",
          },
        );

        results.push({
          leadId: lead.id,
          status: "accepted",
        });
      } catch (error) {
        const errorCode =
          error instanceof
          EmailProviderRateLimitError
            ? "PROVIDER_RATE_LIMITED"
            : error instanceof
                EmailProviderUnavailableError
              ? "PROVIDER_UNAVAILABLE"
              : "PROVIDER_FAILURE";

        const message =
          error instanceof
          EmailProviderRateLimitError
            ? "Email provider rate limit reached."
            : error instanceof
                EmailProviderUnavailableError
              ? "Email sending is not configured."
              : error instanceof
                  EmailProviderTemporaryError
                ? "Email provider is temporarily unavailable."
                : "Unable to send email.";

        await updateCampaignDelivery(
          accessToken,
          delivery.id,
          {
            status: "failed",
            error_code: errorCode,
            error_message: message,
          },
        );

        results.push({
          leadId: lead.id,
          status: "failed",
          error: message,
        });

        if (
          error instanceof
            EmailProviderUnavailableError ||
          error instanceof
            EmailProviderRateLimitError
        ) {
          break;
        }
      }
    }

    return NextResponse.json({
      accepted: results.filter(
        (result) =>
          result.status === "accepted",
      ).length,
      failed: results.filter(
        (result) =>
          result.status === "failed",
      ).length,
      results,
    });
  } catch (error) {
    const unauthenticated =
      error instanceof Error &&
      error.message === "UNAUTHENTICATED";

    return NextResponse.json(
      {
        error: unauthenticated
          ? "Authentication required."
          : "Unable to send campaign.",
      },
      {
        status: unauthenticated
          ? 401
          : 500,
      },
    );
  }
}