import { getConfig } from "@/lib/supabase-auth";

type EmailJob = {
  id: string;
  user_id: string;
  campaign_id: string;
  delivery_id: string;
  inbox_id: string;
  status: "queued" | "processing" | "sent" | "failed";
  attempts: number;
  available_at: string;
  locked_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

function getRestUrl() {
  const { url } = getConfig();
  return `${url}/rest/v1`;
}

function getHeaders(token: string) {
  const { key } = getConfig();

  return {
    apikey: key,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

async function getExistingEmailJob(
  accessToken: string,
  deliveryId: string
): Promise<EmailJob | null> {
  const response = await fetch(
    `${getRestUrl()}/email_jobs?delivery_id=eq.${encodeURIComponent(
      deliveryId
    )}&select=*`,
    {
      method: "GET",
      headers: getHeaders(accessToken),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `Unable to check existing email job (${response.status}): ${body.slice(
        0,
        500
      )}`
    );
  }

  const rows = (await response.json()) as EmailJob[];

  return rows[0] ?? null;
}

export async function enqueueEmailJob(
  accessToken: string,
  input: {
    userId: string;
    campaignId: string;
    deliveryId: string;
    inboxId: string;
  }
): Promise<EmailJob> {
  const existingJob = await getExistingEmailJob(
    accessToken,
    input.deliveryId
  );

  if (existingJob) {
    return existingJob;
  }

  const response = await fetch(
    `${getRestUrl()}/email_jobs`,
    {
      method: "POST",
      headers: getHeaders(accessToken),
      body: JSON.stringify({
        user_id: input.userId,
        campaign_id: input.campaignId,
        delivery_id: input.deliveryId,
        inbox_id: input.inboxId,
        status: "queued",
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const body = await response.text();

    if (
      response.status === 409 &&
      body.includes("email_jobs_delivery_unique")
    ) {
      const existingAfterConflict =
        await getExistingEmailJob(
          accessToken,
          input.deliveryId
        );

      if (existingAfterConflict) {
        return existingAfterConflict;
      }
    }

    throw new Error(
      `Unable to queue email job (${response.status}): ${body.slice(
        0,
        500
      )}`
    );
  }

  const rows = (await response.json()) as EmailJob[];

  if (!rows[0]) {
    throw new Error("Email job was not created.");
  }

  return rows[0];
}