import { NextResponse } from "next/server";

import { requireAuthenticatedUser } from "@/lib/supabase-db";

import {
  decrypt,
  encrypt,
} from "@/lib/google-oauth";

import {
  getGmailAccessToken,
  listGmailMessages,
  getGmailMessage,
  extractGmailMessageContent,
} from "@/lib/gmail";

type ConnectedInbox = {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  provider: "google" | "smtp";
  status:
    | "active"
    | "paused"
    | "disconnected";
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string;
};

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function getSupabaseConfig() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase environment is not configured.",
    );
  }

  return {
    url,
    anonKey,
  };
}

async function supabaseRequest(
  accessToken: string,
  path: string,
  options: RequestInit = {},
) {
  const {
    url,
    anonKey,
  } =
    await getSupabaseConfig();

  const headers = new Headers(
    options.headers,
  );

  headers.set(
    "apikey",
    anonKey,
  );

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
      `connected_inboxes?select=id,user_id,email,display_name,provider,status,access_token,refresh_token,token_expires_at&id=eq.${encodeURIComponent(
        inboxId,
      )}&limit=1`,
    );

  if (!response.ok) {
    const details =
      await response.text().catch(
        () => "",
      );

    console.error(
      "Unable to load connected inbox:",
      details,
    );

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
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (
    !serviceRoleKey ||
    !supabaseUrl
  ) {
    throw new Error(
      "Supabase service configuration is missing.",
    );
  }

  const encryptedAccessToken =
    encrypt(newAccessToken);

  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/connected_inboxes?id=eq.${encodeURIComponent(
        inbox.id,
      )}`,
      {
        method: "PATCH",
        headers: {
          apikey: serviceRoleKey,
          Authorization:
            `Bearer ${serviceRoleKey}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          access_token:
            encryptedAccessToken,
          token_expires_at:
            expiresAt,
          status: "active",
          updated_at:
            new Date().toISOString(),
        }),
        cache: "no-store",
      },
    );

  if (!response.ok) {
    console.error(
      "Unable to update refreshed Gmail token:",
      await response
        .text()
        .catch(() => ""),
    );
  }
}

async function markInboxDisconnected(
  inbox: ConnectedInbox,
) {
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (
    !serviceRoleKey ||
    !supabaseUrl
  ) {
    console.error(
      "Unable to mark Gmail inbox disconnected: Supabase service configuration is missing.",
    );

    return;
  }

  try {
    const response =
      await fetch(
        `${supabaseUrl}/rest/v1/connected_inboxes?id=eq.${encodeURIComponent(
          inbox.id,
        )}&user_id=eq.${encodeURIComponent(
          inbox.user_id,
        )}`,
        {
          method: "PATCH",
          headers: {
            apikey:
              serviceRoleKey,
            Authorization:
              `Bearer ${serviceRoleKey}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            status:
              "disconnected",
            updated_at:
              new Date().toISOString(),
          }),
          cache: "no-store",
        },
      );

    if (!response.ok) {
      console.error(
        "Unable to mark Gmail inbox disconnected:",
        await response
          .text()
          .catch(() => ""),
      );
    }
  } catch (error) {
    console.error(
      "Unable to mark Gmail inbox disconnected:",
      error,
    );
  }
}

function isGmailReconnectError(
  error: unknown,
): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes(
      "GMAIL_AUTH_EXPIRED",
    ) ||
    error.message.includes(
      "Reconnect the Gmail inbox",
    )
  );
}

function isGmailNetworkError(
  error: unknown,
): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("GMAIL_NETWORK_TIMEOUT") ||
    error.message.includes("GMAIL_NETWORK_ERROR") ||
    /fetch failed|connect timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENETUNREACH|EAI_AGAIN|socket/i.test(
      error.message,
    )
  );
}

function getGmailNetworkMessage(
  error: unknown,
): string {
  if (
    error instanceof Error &&
    error.message.includes("GMAIL_NETWORK_TIMEOUT")
  ) {
    return "Gmail took too long to respond. Please refresh the inbox and try again.";
  }

  return "Gmail could not be reached right now. Please refresh the inbox and try again.";
}

export async function GET(
  request: Request,
  context: RouteContext,
) {
  let inbox:
    | ConnectedInbox
    | null = null;

  try {
    const {
      user,
      accessToken,
    } =
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

    inbox =
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

    if (
      inbox.user_id !== user.id
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have access to this inbox.",
        },
        { status: 403 },
      );
    }

    if (
      inbox.provider !== "google"
    ) {
      return NextResponse.json(
        {
          error:
            "This inbox does not use Google.",
        },
        { status: 400 },
      );
    }

    if (
      inbox.status ===
      "disconnected"
    ) {
      return NextResponse.json(
        {
          error:
            "This Gmail inbox is disconnected. Please reconnect it.",
          code:
            "GMAIL_RECONNECT_REQUIRED",
        },
        { status: 409 },
      );
    }

    if (!inbox.access_token) {
      return NextResponse.json(
        {
          error:
            "Gmail access token is missing. Please reconnect the inbox.",
          code:
            "GMAIL_RECONNECT_REQUIRED",
        },
        { status: 409 },
      );
    }

    const decryptedAccessToken =
      decrypt(
        inbox.access_token,
      );

    const decryptedRefreshToken =
      inbox.refresh_token
        ? decrypt(
            inbox.refresh_token,
          )
        : null;

    let token;

    try {
      token =
        await getGmailAccessToken(
          {
            accessToken:
              decryptedAccessToken,
            refreshToken:
              decryptedRefreshToken,
            tokenExpiresAt:
              inbox.token_expires_at,
          },
        );
    } catch (error) {
      if (
        isGmailReconnectError(
          error,
        )
      ) {
        await markInboxDisconnected(
          inbox,
        );

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

      throw error;
    }

    if (token.refreshed) {
      await updateAccessToken(
        inbox,
        token.accessToken,
        token.expiresAt,
      );

      inbox = {
        ...inbox,
        token_expires_at:
          token.expiresAt,
        status: "active",
      };
    }

    const url =
      new URL(request.url);

    const maxResultsParam =
      Number(
        url.searchParams.get(
          "maxResults",
        ) ?? "20",
      );

    const maxResults = Math.min(
      Math.max(
        Number.isFinite(
          maxResultsParam,
        )
          ? Math.floor(
              maxResultsParam,
            )
          : 20,
        1,
      ),
      50,
    );

    const pageToken =
      url.searchParams.get(
        "pageToken",
      ) ?? undefined;

    const query =
      url.searchParams.get(
        "q",
      ) ?? undefined;

    let list;

    try {
      list =
        await listGmailMessages(
          token.accessToken,
          {
            maxResults,
            pageToken,
            q: query,
            labelIds: ["INBOX"],
          },
        );
    } catch (error) {
      if (
        isGmailReconnectError(
          error,
        )
      ) {
        await markInboxDisconnected(
          inbox,
        );

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

      throw error;
    }

    const messageItems =
      list.messages ?? [];

    const hydratedMessages: Array<{
  id: string;
  threadId: string;
  snippet: string;
  internalDate: string | null;
  labelIds: string[];
  from: string;
  to: string;
  cc: string;
  bcc: string;
  replyTo: string;
  subject: string;
  date: string;
  messageId: string;
  bodyText: string;
  bodyHtml: string;
} | null> = [];

const BATCH_SIZE = 5;

for (
  let index = 0;
  index < messageItems.length;
  index += BATCH_SIZE
) {
  const batch = messageItems.slice(
    index,
    index + BATCH_SIZE,
  );

  const batchResults =
    await Promise.all(
      batch.map(
        async (item) => {
          try {
            const message =
              await getGmailMessage(
                token.accessToken,
                item.id,
              );

            const content =
              extractGmailMessageContent(
                message,
              );

            return {
              id: message.id,
              threadId:
                message.threadId,
              snippet:
                message.snippet ?? "",
              internalDate:
                message.internalDate ?? null,
              labelIds:
                message.labelIds ?? [],
              ...content,
            };
          } catch (error) {
            if (
              isGmailReconnectError(
                error,
              )
            ) {
              throw error;
            }

            if (
              isGmailNetworkError(
                error,
              )
            ) {
              console.warn(
                `Gmail message ${item.id} could not be loaded because of a network timeout.`,
              );

              return null;
            }

            console.error(
              `Unable to load Gmail message ${item.id}:`,
              error,
            );

            return null;
          }
        },
      ),
    );

  hydratedMessages.push(
    ...batchResults,
  );
}

const messages =
  hydratedMessages.filter(
    (
      message,
    ): message is NonNullable<
      typeof message
    > =>
      message !== null,
  );

    return NextResponse.json(
      {
        inbox: {
          id: inbox.id,
          email:
            inbox.email,
          displayName:
            inbox.display_name,
          provider:
            inbox.provider,
          status:
            inbox.status,
        },
        messages:
          messages.filter(
            (
              message,
            ): message is NonNullable<
              typeof message
            > =>
              message !== null,
          ),
        nextPageToken:
          list.nextPageToken ??
          null,
        resultSizeEstimate:
          list.resultSizeEstimate ??
          messageItems.length,
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "Gmail messages route failed:",
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
      inbox &&
      isGmailReconnectError(
        error,
      )
    ) {
      await markInboxDisconnected(
        inbox,
      );

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
if (
  isGmailNetworkError(
    error,
  )
) {
  return NextResponse.json(
    {
      error:
        getGmailNetworkMessage(
          error,
        ),
      code:
        "GMAIL_NETWORK_ERROR",
    },
    { status: 503 },
  );
}
    if (
      error instanceof Error &&
      error.message.includes(
        "GMAIL_API_ERROR",
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Gmail could not complete the request right now. Please try again.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Unable to load Gmail messages.",
      },
      { status: 500 },
    );
  }
}