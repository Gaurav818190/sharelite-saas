import { decrypt, encrypt } from "@/lib/google-oauth";
import { getGmailAccessToken, sendGmailMessage } from "@/lib/gmail";
import { getConfig } from "@/lib/supabase-auth";

type ConnectedInbox = {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  provider: string;
  status: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  daily_send_limit: number | null;
  daily_sent_count: number | null;
  daily_count_date: string | null;
  last_sent_at: string | null;
};

type Campaign = {
  id: string;
  user_id: string;
  template_id: string | null;
};

type Delivery = {
  id: string;
  campaign_id: string;
  lead_id: string;
  user_id: string;
  email_subject: string | null;
  email_body: string | null;
  status: "pending" | "sending" | "accepted" | "failed";
};

type Lead = {
  id: string;
  user_id: string;
  email: string | null;
  validation_status: string | null;
};

type Template = {
  id: string;
  user_id: string;
  subject: string | null;
  body: string | null;
};

function getRestUrl() {
  const { url } = getConfig();
  return `${url}/rest/v1`;
}

function getServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured."
    );
  }

  return key;
}

function getServiceHeaders() {
  const key = getServiceRoleKey();

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function restRequest<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(
    `${getRestUrl()}${path}`,
    {
      ...init,
      headers: {
        ...getServiceHeaders(),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `Supabase request failed (${response.status}): ${body.slice(
        0,
        500
      )}`
    );
  }

  const text = await response.text();

  if (!text) {
    return null as T;
  }

  return JSON.parse(text) as T;
}

async function getCampaign(
  campaignId: string,
  userId: string
): Promise<Campaign | null> {
  const rows = await restRequest<Campaign[]>(
    `/campaigns?id=eq.${encodeURIComponent(
      campaignId
    )}&user_id=eq.${encodeURIComponent(
      userId
    )}&select=id,user_id,template_id&limit=1`
  );

  return rows[0] ?? null;
}

async function getDelivery(
  deliveryId: string,
  userId: string
): Promise<Delivery | null> {
  const rows = await restRequest<Delivery[]>(
    `/campaign_deliveries?id=eq.${encodeURIComponent(
      deliveryId
    )}&user_id=eq.${encodeURIComponent(
      userId
    )}&select=id,campaign_id,lead_id,user_id,email_subject,email_body,status&limit=1`
  );

  return rows[0] ?? null;
}

async function getLead(
  leadId: string,
  userId: string
): Promise<Lead | null> {
  const rows = await restRequest<Lead[]>(
    `/leads?id=eq.${encodeURIComponent(
      leadId
    )}&user_id=eq.${encodeURIComponent(
      userId
    )}&select=id,user_id,email,validation_status&limit=1`
  );

  return rows[0] ?? null;
}

async function getTemplate(
  templateId: string,
  userId: string
): Promise<Template | null> {
  const rows = await restRequest<Template[]>(
    `/templates?id=eq.${encodeURIComponent(
      templateId
    )}&user_id=eq.${encodeURIComponent(
      userId
    )}&select=id,user_id,subject,body&limit=1`
  );

  return rows[0] ?? null;
}

async function getConnectedInbox(
  inboxId: string,
  userId: string
): Promise<ConnectedInbox | null> {
  const rows = await restRequest<ConnectedInbox[]>(
    `/connected_inboxes?id=eq.${encodeURIComponent(
      inboxId
    )}&user_id=eq.${encodeURIComponent(
      userId
    )}&select=id,user_id,email,display_name,provider,status,access_token,refresh_token,token_expires_at,daily_send_limit,daily_sent_count,daily_count_date,last_sent_at&limit=1`
  );

  return rows[0] ?? null;
}

async function updateDelivery(
  deliveryId: string,
  userId: string,
  values: Record<string, unknown>
) {
  await restRequest(
    `/campaign_deliveries?id=eq.${encodeURIComponent(
      deliveryId
    )}&user_id=eq.${encodeURIComponent(
      userId
    )}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        ...values,
        updated_at: new Date().toISOString(),
      }),
    }
  );
}

async function saveRefreshedToken(
  inboxId: string,
  accessToken: string,
  expiresAt: string
) {
  await restRequest(
    `/connected_inboxes?id=eq.${encodeURIComponent(
      inboxId
    )}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        access_token: encrypt(accessToken),
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }),
    }
  );
}

async function incrementInboxSendCount(
  inboxId: string
) {
  await restRequest(
    `/rpc/increment_inbox_send_count`,
    {
      method: "POST",
      body: JSON.stringify({
        p_inbox_id: inboxId,
      }),
    }
  );
}

export type SendEmailInput = {
  userId: string;
  campaignId: string;
  deliveryId: string;
  inboxId: string;
};

export type SendEmailResult = {
  providerMessageId: string;
  sentAt: string;
  inboxId: string;
  email: string;
};

export async function sendCampaignEmail(
  input: SendEmailInput
): Promise<SendEmailResult> {
  const {
    userId,
    campaignId,
    deliveryId,
    inboxId,
  } = input;

  const campaign = await getCampaign(
    campaignId,
    userId
  );

  if (!campaign) {
    throw new Error("Campaign was not found.");
  }

  const delivery = await getDelivery(
    deliveryId,
    userId
  );

  if (!delivery) {
    throw new Error(
      "Campaign delivery was not found."
    );
  }

  if (
  delivery.status === "accepted"
) {
  throw new Error(
    "Delivery has already been sent."
  );
}

  if (delivery.campaign_id !== campaignId) {
    throw new Error(
      "Campaign delivery does not belong to this campaign."
    );
  }

  const inbox = await getConnectedInbox(
    inboxId,
    userId
  );

  if (!inbox) {
    throw new Error(
      "Connected Gmail inbox was not found."
    );
  }

  if (inbox.provider !== "google") {
    throw new Error(
      "Selected inbox is not a Google inbox."
    );
  }

  if (inbox.status !== "active") {
    throw new Error(
      "Selected Gmail inbox is not active."
    );
  }

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  const dailyCount =
    inbox.daily_count_date?.slice(0, 10) === today
      ? Number(inbox.daily_sent_count ?? 0)
      : 0;

  const dailyLimit =
    Number(inbox.daily_send_limit ?? 0) > 0
      ? Number(inbox.daily_send_limit)
      : 100;

  if (dailyCount >= dailyLimit) {
    throw new Error(
      "Daily sending limit reached for the selected Gmail inbox."
    );
  }

  const lead = await getLead(
    delivery.lead_id,
    userId
  );

  if (!lead) {
    throw new Error("Lead was not found.");
  }

  if (
    lead.validation_status !== "valid" ||
    !lead.email ||
    !lead.email.includes("@")
  ) {
    throw new Error(
      "This lead does not have a valid email address."
    );
  }

  const template = campaign.template_id
    ? await getTemplate(
        campaign.template_id,
        userId
      )
    : null;

  const finalSubject =
    delivery.email_subject?.trim() ||
    template?.subject?.trim() ||
    "Hello from ShareLite";

  const finalMessage =
    delivery.email_body?.trim() ||
    template?.body?.trim() ||
    "";

  if (!finalMessage) {
    throw new Error(
      "No email message is available for this delivery."
    );
  }

  await updateDelivery(
    deliveryId,
    userId,
    {
      status: "sending",
      error_code: null,
      error_message: null,
    }
  );

  if (!inbox.access_token) {
    throw new Error("GMAIL_AUTH_EXPIRED");
  }

  const accessToken = decrypt(
    inbox.access_token
  );

  const refreshToken = inbox.refresh_token
    ? decrypt(inbox.refresh_token)
    : null;

  let tokenResult = await getGmailAccessToken({
    accessToken,
    refreshToken,
    tokenExpiresAt:
      inbox.token_expires_at ??
      new Date(0).toISOString(),
  });

  if (tokenResult.refreshed) {
    await saveRefreshedToken(
      inbox.id,
      tokenResult.accessToken,
      new Date(
        tokenResult.expiresAt
      ).toISOString()
    );
  }

  let sent: { id: string };

  try {
    sent = await sendGmailMessage({
      accessToken: tokenResult.accessToken,
      to: lead.email,
      subject: finalSubject,
      body: finalMessage,
    });
  } catch (error) {
    const authExpired =
      error instanceof Error &&
      error.message === "GMAIL_AUTH_EXPIRED";

    if (!authExpired || !refreshToken) {
      throw error;
    }

    tokenResult = await getGmailAccessToken({
      accessToken: tokenResult.accessToken,
      refreshToken,
      tokenExpiresAt:
        new Date(0).toISOString(),
    });

    await saveRefreshedToken(
      inbox.id,
      tokenResult.accessToken,
      new Date(
        tokenResult.expiresAt
      ).toISOString()
    );

    sent = await sendGmailMessage({
      accessToken: tokenResult.accessToken,
      to: lead.email,
      subject: finalSubject,
      body: finalMessage,
    });
  }

  const sentAt = new Date().toISOString();

  await updateDelivery(
    deliveryId,
    userId,
    {
      status: "accepted",
      provider_message_id: sent.id,
      sent_at: sentAt,
      error_code: null,
      error_message: null,
    }
  );

  await incrementInboxSendCount(
    inbox.id
  );

  return {
    providerMessageId: sent.id,
    sentAt,
    inboxId: inbox.id,
    email: inbox.email,
  };
}