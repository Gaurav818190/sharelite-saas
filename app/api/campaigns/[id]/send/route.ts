import { NextResponse } from "next/server";
import { enqueueEmailJob } from "@/lib/email-queue";
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

type SendInput = {
  deliveryId?: string;
  subject?: string;
  message?: string;
  inboxId?: string;
};

type ConnectedInbox = {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  provider: string;
  status: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  daily_send_limit: number | null;
  daily_sent_count: number | null;
  daily_count_date: string | null;
  last_sent_at: string | null;
};

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getTodayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function getDailyCount(inbox: ConnectedInbox) {
  if (inbox.daily_count_date !== getTodayUtc()) {
    return 0;
  }

  return Number(inbox.daily_sent_count ?? 0);
}

function getDailyLimit(inbox: ConnectedInbox) {
  const limit = Number(inbox.daily_send_limit ?? 0);

  return limit > 0 ? limit : 100;
}

async function getConnectedInbox(
  accessToken: string,
  userId: string,
  inboxId: string
): Promise<ConnectedInbox | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase server configuration is missing."
    );
  }

  const query = new URLSearchParams({
    select:
      "id,user_id,email,display_name,provider,status,access_token,refresh_token,token_expires_at,daily_send_limit,daily_sent_count,daily_count_date,last_sent_at",
    user_id: `eq.${userId}`,
    id: `eq.${inboxId}`,
    limit: "1",
  });

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/connected_inboxes?${query.toString()}`,
    {
      method: "GET",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `Unable to load connected inbox (${response.status}): ${body.slice(
        0,
        500
      )}`
    );
  }

  const rows =
    (await response.json()) as ConnectedInbox[];

  return rows[0] ?? null;
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  let deliveryId: string | undefined;

  try {
    const auth = await requireAuthenticatedUser();
    const user = auth.user;

    const { id: campaignId } = await context.params;

    const input = (await request.json()) as SendInput;

    deliveryId = input.deliveryId;

    if (!campaignId) {
      return NextResponse.json(
        {
          error: "Campaign ID is required.",
        },
        { status: 400 }
      );
    }

    if (!deliveryId) {
      return NextResponse.json(
        {
          error: "Delivery ID is required.",
        },
        { status: 400 }
      );
    }

    if (!input.inboxId) {
      return NextResponse.json(
        {
          error:
            "Please select a Gmail inbox first.",
        },
        { status: 400 }
      );
    }

    const campaign = await getCampaign(
      auth.accessToken,
      campaignId
    );

    if (!campaign) {
      return NextResponse.json(
        {
          error: "Campaign not found.",
        },
        { status: 404 }
      );
    }

    const delivery = await getCampaignDelivery(
      auth.accessToken,
      deliveryId
    );

    if (!delivery) {
      return NextResponse.json(
        {
          error:
            "Campaign delivery not found.",
        },
        { status: 404 }
      );
    }

    if (delivery.campaign_id !== campaignId) {
      return NextResponse.json(
        {
          error:
            "Delivery does not belong to this campaign.",
        },
        { status: 400 }
      );
    }

    const inbox = await getConnectedInbox(
      auth.accessToken,
      user.id,
      input.inboxId
    );

    if (!inbox) {
      return NextResponse.json(
        {
          error:
            "Selected Gmail inbox was not found.",
        },
        { status: 404 }
      );
    }

    if (inbox.provider !== "google") {
      return NextResponse.json(
        {
          error:
            "Selected inbox is not a Google inbox.",
        },
        { status: 400 }
      );
    }

    if (inbox.status !== "active") {
      return NextResponse.json(
        {
          error:
            "Selected Gmail inbox is not active. Please reconnect it.",
        },
        { status: 400 }
      );
    }

    const dailyCount = getDailyCount(inbox);
    const dailyLimit = getDailyLimit(inbox);

    if (dailyCount >= dailyLimit) {
      return NextResponse.json(
        {
          error: `Daily sending limit reached for ${inbox.email}.`,
        },
        { status: 429 }
      );
    }

    const lead = await getLead(
      auth.accessToken,
      delivery.lead_id
    );

    if (!lead) {
      return NextResponse.json(
        {
          error: "Lead not found.",
        },
        { status: 404 }
      );
    }

    if (
      lead.validation_status !== "valid" ||
      !lead.email ||
      !lead.email.includes("@")
    ) {
      return NextResponse.json(
        {
          error:
            "This lead does not have a valid email address.",
        },
        { status: 400 }
      );
    }

    const template = campaign.template_id
      ? await getTemplate(
          auth.accessToken,
          campaign.template_id
        )
      : null;

    const subject =
      delivery.email_subject?.trim() ||
      input.subject?.trim() ||
      template?.subject?.trim() ||
      "Hello from ShareLite";

    const message =
      delivery.email_body?.trim() ||
      input.message?.trim() ||
      template?.body?.trim() ||
      "";

    if (!message) {
      return NextResponse.json(
        {
          error:
            "Email message cannot be empty.",
        },
        { status: 400 }
      );
    }

    /*
     * Save the final subject/body before creating
     * the queue job so the background worker can
     * send exactly the content selected here.
     */
    const existingSubject =
      delivery.email_subject?.trim() ?? "";

    const existingBody =
      delivery.email_body?.trim() ?? "";

    if (
      existingSubject !== subject ||
      existingBody !== message
    ) {
      await updateCampaignDelivery(
        auth.accessToken,
        deliveryId,
        {
          email_subject: subject,
          email_body: message,
        }
      );
    }

    const job = await enqueueEmailJob(
      auth.accessToken,
      {
        userId: user.id,
        campaignId,
        deliveryId,
        inboxId: input.inboxId,
      }
    );

    return NextResponse.json(
      {
        success: true,
        queued: true,
        message:
          "Email has been added to the sending queue.",
        jobId: job.id,
        inboxId: input.inboxId,
        subject,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error(
      "Campaign queue error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to queue campaign email.",
      },
      { status: 500 }
    );
  }
}