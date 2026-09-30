import { NextResponse } from "next/server";

import { requireAuthenticatedUser } from "@/lib/supabase-db";
import {
  decrypt,
  encrypt,
} from "@/lib/google-oauth";
import {
  getGmailAccessToken,
  sendGmailMessage,
  replyToGmailThread,
} from "@/lib/gmail";

type ConnectedInbox = {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  provider: "google" | "smtp";
  status: "active" | "paused" | "disconnected";
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string;
  daily_send_limit: number;
  daily_sent_count: number;
  daily_count_date: string;
};

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error(
      "Supabase environment is not configured.",
    );
  }

  return {
    url,
    anonKey,
    serviceRoleKey,
  };
}

async function supabaseRequest(
  accessToken: string,
  path: string,
  options: RequestInit = {},
) {
  const { url, anonKey } =
    await getSupabaseConfig();

  const headers = new Headers(options.headers);

  headers.set("apikey", anonKey);
  headers.set(
    "Authorization",
    `Bearer ${accessToken}`,
  );
  headers.set(
    "Content-Type",
    "application/json",
  );

  return fetch(
    `${url}/rest/v1/${path}`,
    {
      ...options,
      headers,
      cache: "no-store",
    },
  );
}

async function getConnectedInbox(
  accessToken: string,
  inboxId: string,
) {
  const response =
    await supabaseRequest(
      accessToken,
      `connected_inboxes?select=id,user_id,email,display_name,provider,status,access_token,refresh_token,token_expires_at,daily_send_limit,daily_sent_count,daily_count_date&id=eq.${encodeURIComponent(
        inboxId,
      )}&limit=1`,
    );

  if (!response.ok) {
    throw new Error(
      "Unable to load connected inbox.",
    );
  }

  const rows =
    (await response.json()) as ConnectedInbox[];

  return rows[0] ?? null;
}

async function updateAccessToken(
  inbox: ConnectedInbox,
  newAccessToken: string,
  expiresAt: string,
) {
  const {
    url,
    serviceRoleKey,
  } = await getSupabaseConfig();

  const response = await fetch(
    `${url}/rest/v1/connected_inboxes?id=eq.${encodeURIComponent(
      inbox.id,
    )}`,
    {
      method: "PATCH",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        access_token:
          encrypt(newAccessToken),
        token_expires_at: expiresAt,
        updated_at:
          new Date().toISOString(),
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    console.error(
      "Unable to save refreshed Gmail token:",
      await response.text().catch(() => ""),
    );
  }
}

async function updateSendCounter(
  inbox: ConnectedInbox,
) {
  const {
    url,
    serviceRoleKey,
  } = await getSupabaseConfig();

  const today =
    new Date().toISOString().slice(0, 10);

  const currentCount =
    inbox.daily_count_date === today
      ? inbox.daily_sent_count
      : 0;

  const response = await fetch(
    `${url}/rest/v1/connected_inboxes?id=eq.${encodeURIComponent(
      inbox.id,
    )}`,
    {
      method: "PATCH",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        daily_sent_count:
          currentCount + 1,
        daily_count_date: today,
        last_sent_at:
          new Date().toISOString(),
        updated_at:
          new Date().toISOString(),
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    console.error(
      "Unable to update inbox send counter:",
      await response.text().catch(() => ""),
    );
  }
}

function validateEmail(
  value: string,
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value.trim(),
  );
}

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const { user, accessToken } =
      await requireAuthenticatedUser();

    const { id } =
      await context.params;

    if (!id) {
      return NextResponse.json(
        {
          error:
            "Inbox ID is required.",
        },
        { status: 400 },
      );
    }

    const inbox =
      await getConnectedInbox(
        accessToken,
        id,
      );

    if (!inbox) {
      return NextResponse.json(
        {
          error:
            "Connected inbox not found.",
        },
        { status: 404 },
      );
    }

    if (inbox.user_id !== user.id) {
      return NextResponse.json(
        {
          error:
            "You do not have access to this inbox.",
        },
        { status: 403 },
      );
    }

    if (inbox.provider !== "google") {
      return NextResponse.json(
        {
          error:
            "This inbox does not use Google.",
        },
        { status: 400 },
      );
    }

    if (inbox.status !== "active") {
      return NextResponse.json(
        {
          error:
            "This inbox is not active.",
        },
        { status: 409 },
      );
    }

    const body =
      (await request.json()) as {
        to?: string;
        cc?: string;
        subject?: string;
        body?: string;
        threadId?: string;
        messageId?: string;
        references?: string;
      };

    const to =
      body.to?.trim() ?? "";

    const subject =
      body.subject?.trim() ?? "";

    const messageBody =
      body.body?.trim() ?? "";

    if (!to || !validateEmail(to)) {
      return NextResponse.json(
        {
          error:
            "A valid recipient email address is required.",
        },
        { status: 400 },
      );
    }

    if (!subject) {
      return NextResponse.json(
        {
          error:
            "Email subject is required.",
        },
        { status: 400 },
      );
    }

    if (!messageBody) {
      return NextResponse.json(
        {
          error:
            "Email body is required.",
        },
        { status: 400 },
      );
    }

    const today =
      new Date().toISOString().slice(0, 10);

    const sentToday =
      inbox.daily_count_date === today
        ? inbox.daily_sent_count
        : 0;

    if (
      sentToday >=
      inbox.daily_send_limit
    ) {
      return NextResponse.json(
        {
          error:
            "Daily sending limit reached for this inbox.",
          code:
            "DAILY_SEND_LIMIT_REACHED",
        },
        { status: 429 },
      );
    }

    const decryptedAccessToken =
      decrypt(inbox.access_token);

    const decryptedRefreshToken =
      inbox.refresh_token
        ? decrypt(inbox.refresh_token)
        : null;

    const token =
      await getGmailAccessToken({
        accessToken:
          decryptedAccessToken,
        refreshToken:
          decryptedRefreshToken,
        tokenExpiresAt:
          inbox.token_expires_at,
      });

    if (token.refreshed) {
      await updateAccessToken(
        inbox,
        token.accessToken,
        token.expiresAt!,
      );
    }

    let sentMessage;

    if (
      body.threadId &&
      body.messageId
    ) {
      sentMessage =
  await replyToGmailThread({
    accessToken: token.accessToken,
    to,
    subject,
    body: messageBody,
    threadId: body.threadId,
    messageId: body.messageId,
    references: body.references,
    cc: body.cc?.trim() || undefined,
  });
  
    } else {
      sentMessage =
  await sendGmailMessage({
    accessToken: token.accessToken,
    to,
    subject,
    body: messageBody,
    cc: body.cc?.trim() || undefined,
  });
    }

    await updateSendCounter(
      inbox,
    );

    return NextResponse.json({
      success: true,
      message: {
        id: sentMessage.id,
        threadId:
          sentMessage.threadId,
      },
    });
  } catch (error) {
    console.error(
      "Gmail send route failed:",
      error,
    );

    if (
      error instanceof Error &&
      error.message ===
        "UNAUTHENTICATED"
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
      error instanceof Error &&
      error.message.includes(
        "Reconnect the Gmail inbox",
      )
    ) {
      return NextResponse.json(
        {
          error:
            error.message,
          code:
            "GMAIL_RECONNECT_REQUIRED",
        },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message.includes(
        "GMAIL_AUTH_EXPIRED",
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Gmail authorization expired. Please reconnect the inbox.",
          code:
            "GMAIL_RECONNECT_REQUIRED",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Unable to send Gmail message.",
      },
      { status: 500 },
    );
  }
}