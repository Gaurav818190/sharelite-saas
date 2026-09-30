import { NextResponse } from "next/server";
import { sendCampaignEmail } from "@/lib/email-sender";
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
};

type JobResult = {
  success: boolean;
  retried?: boolean;
  jobId: string;
  inboxId: string;
  error?: string;
};

function getRestUrl() {
  const { url } = getConfig();
  return `${url}/rest/v1`;
}

function getServiceHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured."
    );
  }

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function claimJobs(
  limit = 5
): Promise<EmailJob[]> {
  const response = await fetch(
    `${getRestUrl()}/rpc/claim_email_jobs`,
    {
      method: "POST",
      headers: getServiceHeaders(),
      body: JSON.stringify({
        p_limit: Math.min(
          Math.max(limit, 1),
          10
        ),
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `Unable to claim email jobs (${response.status}): ${body.slice(
        0,
        500
      )}`
    );
  }

  return (await response.json()) as EmailJob[];
}

async function updateJob(
  jobId: string,
  values: Record<string, unknown>
) {
  const response = await fetch(
    `${getRestUrl()}/email_jobs?id=eq.${encodeURIComponent(
      jobId
    )}`,
    {
      method: "PATCH",
      headers: {
        ...getServiceHeaders(),
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        ...values,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `Unable to update email job (${response.status}): ${body.slice(
        0,
        500
      )}`
    );
  }
}

async function processJob(
  job: EmailJob
) {
  return sendCampaignEmail({
    userId: job.user_id,
    campaignId: job.campaign_id,
    deliveryId: job.delivery_id,
    inboxId: job.inbox_id,
  });
}

async function processJobWithRetry(
  job: EmailJob
): Promise<JobResult> {
  try {
    await processJob(job);

    await updateJob(job.id, {
      status: "sent",
      completed_at: new Date().toISOString(),
      locked_at: null,
      error_message: null,
    });

    return {
      success: true,
      jobId: job.id,
      inboxId: job.inbox_id,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Email sending failed.";

    console.error(
      `Email worker job ${job.id} failed:`,
      error
    );

    const shouldRetry = job.attempts < 3;

    if (shouldRetry) {
      const retryDelay = Math.min(
        Math.max(job.attempts, 1) * 60,
        5 * 60
      );

      await updateJob(job.id, {
        status: "queued",
        available_at: new Date(
          Date.now() + retryDelay * 1000
        ).toISOString(),
        locked_at: null,
        completed_at: null,
        error_message: message.slice(0, 1000),
      });

      return {
        success: false,
        retried: true,
        jobId: job.id,
        inboxId: job.inbox_id,
        error: message,
      };
    }

    await updateJob(job.id, {
      status: "failed",
      completed_at: new Date().toISOString(),
      locked_at: null,
      error_message: message.slice(0, 1000),
    });

    return {
      success: false,
      retried: false,
      jobId: job.id,
      inboxId: job.inbox_id,
      error: message,
    };
  }
}

async function processJobs(
  jobs: EmailJob[]
): Promise<JobResult[]> {
  const groups = new Map<string, EmailJob[]>();

  for (const job of jobs) {
    const existing =
      groups.get(job.inbox_id) ?? [];

    existing.push(job);
    groups.set(job.inbox_id, existing);
  }

  const groupResults =
    await Promise.all(
      Array.from(groups.values()).map(
        async (inboxJobs) => {
          const results: JobResult[] = [];

          for (const job of inboxJobs) {
            const result =
              await processJobWithRetry(job);

            results.push(result);
          }

          return results;
        }
      )
    );

  return groupResults.flat();
}

function isAuthorizedCronRequest(
  request: Request
) {
  const cronSecret =
    process.env.CRON_SECRET;

  const workerSecret =
    process.env.EMAIL_WORKER_SECRET;

  const authorization =
    request.headers.get("authorization");

  const suppliedSecret =
    authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

  if (
    cronSecret &&
    suppliedSecret === cronSecret
  ) {
    return true;
  }

  if (
    workerSecret &&
    suppliedSecret === workerSecret
  ) {
    return true;
  }

  const legacySecret =
    request.headers.get(
      "x-email-worker-secret"
    );

  if (
    workerSecret &&
    legacySecret === workerSecret
  ) {
    return true;
  }

  return false;
}

export async function GET(
  request: Request
) {
  try {
    if (!isAuthorizedCronRequest(request)) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const jobs = await claimJobs(5);

    if (jobs.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        sent: 0,
        failed: 0,
        retried: 0,
        message: "No queued email jobs.",
      });
    }

    const results =
      await processJobs(jobs);

    const sent = results.filter(
      (result) => result.success
    ).length;

    const failed = results.filter(
      (result) =>
        !result.success &&
        !result.retried
    ).length;

    const retried = results.filter(
      (result) => result.retried
    ).length;

    return NextResponse.json({
      success: true,
      processed: jobs.length,
      sent,
      failed,
      retried,
    });
  } catch (error) {
    console.error(
      "Email worker error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Email worker failed.",
      },
      { status: 500 }
    );
  }
}