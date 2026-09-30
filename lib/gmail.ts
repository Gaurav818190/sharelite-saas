const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE =
  "https://gmail.googleapis.com/gmail/v1/users/me";

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

export type GmailProfile = {
  emailAddress: string;
  messagesTotal?: number;
  threadsTotal?: number;
  historyId?: string;
};

export type GmailMessageHeader = {
  name: string;
  value: string;
};

export type GmailMessageListItem = {
  id: string;
  threadId: string;
};

export type GmailMessagePart = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailMessageHeader[];
  body?: {
    size?: number;
    data?: string;
  };
  parts?: GmailMessagePart[];
};

export type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
};

export type GmailListResponse = {
  messages?: GmailMessageListItem[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

export type GmailAccessTokenResult = {
  accessToken: string;
  expiresAt: string;
  refreshed: boolean;
};

function getGoogleClientConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google OAuth configuration is incomplete. Required: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI.",
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}

async function parseGoogleError(
  response: Response,
): Promise<string> {
  try {
    const data = await response.json();

    if (
      typeof data?.error_description === "string"
    ) {
      return data.error_description;
    }

    if (
      typeof data?.error?.message === "string"
    ) {
      return data.error.message;
    }

    if (typeof data?.error === "string") {
      return data.error;
    }

    return `Google API request failed with status ${response.status}.`;
  } catch {
    return `Google API request failed with status ${response.status}.`;
  }
}

function toExpiresAt(
  expiresInSeconds: number,
): string {
  const expiresIn =
    Number.isFinite(expiresInSeconds) &&
    expiresInSeconds > 0
      ? expiresInSeconds
      : 3600;

  return new Date(
    Date.now() + expiresIn * 1000,
  ).toISOString();
}

export async function exchangeCodeForTokens(
  code: string,
): Promise<GoogleTokenResponse> {
  if (!code) {
    throw new Error(
      "Google authorization code is missing.",
    );
  }

  const {
    clientId,
    clientSecret,
    redirectUri,
  } = getGoogleClientConfig();

  const body = new URLSearchParams();

  body.set("code", code);
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("redirect_uri", redirectUri);
  body.set(
    "grant_type",
    "authorization_code",
  );

  const response = await fetch(
    GOOGLE_TOKEN_URL,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const message =
      await parseGoogleError(response);

    throw new Error(
      `GOOGLE_OAUTH_TOKEN_EXCHANGE_FAILED: ${message}`,
    );
  }

  const data =
    (await response.json()) as GoogleTokenResponse;

  if (!data.access_token) {
    throw new Error(
      "Google did not return an access token.",
    );
  }

  return data;
}

/**
 * Alias kept for compatibility with OAuth callback code
 * that may use the more explicit function name.
 */
export const exchangeGoogleCodeForTokens =
  exchangeCodeForTokens;

export const exchangeGoogleCode =
  exchangeCodeForTokens;

export async function refreshGmailAccessToken(
  refreshToken: string,
): Promise<{
  accessToken: string;
  expiresAt: string;
}> {
  if (!refreshToken) {
    throw new Error(
      "Reconnect the Gmail inbox: refresh token is missing.",
    );
  }

  const {
    clientId,
    clientSecret,
  } = getGoogleClientConfig();

  const body = new URLSearchParams();

  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set(
    "refresh_token",
    refreshToken,
  );
  body.set(
    "grant_type",
    "refresh_token",
  );

  const response = await fetch(
    GOOGLE_TOKEN_URL,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const message =
      await parseGoogleError(response);

    if (
      /invalid_grant|invalid_request|unauthorized|revoked|expired/i.test(
        message,
      )
    ) {
      throw new Error(
        `GMAIL_AUTH_EXPIRED: ${message}`,
      );
    }

    throw new Error(
      `GMAIL_TOKEN_REFRESH_FAILED: ${message}`,
    );
  }

  const data =
    (await response.json()) as GoogleTokenResponse;

  if (!data.access_token) {
    throw new Error(
      "GMAIL_AUTH_EXPIRED: Google did not return a refreshed access token.",
    );
  }

  return {
    accessToken: data.access_token,
    expiresAt: toExpiresAt(
      data.expires_in,
    ),
  };
}

export async function getGmailAccessToken({
  accessToken,
  refreshToken,
  tokenExpiresAt,
}: {
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: string;
}): Promise<GmailAccessTokenResult> {
  if (!accessToken) {
    throw new Error(
      "Gmail access token is missing.",
    );
  }

  const expiresAtTime = Date.parse(
    tokenExpiresAt,
  );

  const shouldRefresh =
    !Number.isFinite(expiresAtTime) ||
    expiresAtTime <=
      Date.now() + 60_000;

  if (!shouldRefresh) {
    return {
      accessToken,
      expiresAt: tokenExpiresAt,
      refreshed: false,
    };
  }

  if (!refreshToken) {
    throw new Error(
      "Reconnect the Gmail inbox: refresh token is missing.",
    );
  }

  const refreshed =
    await refreshGmailAccessToken(
      refreshToken,
    );

  return {
    accessToken:
      refreshed.accessToken,
    expiresAt:
      refreshed.expiresAt,
    refreshed: true,
  };
}

const GMAIL_REQUEST_TIMEOUT_MS = 8_000;

function isAbortError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.name === "AbortError" ||
      /aborted|abort/i.test(error.message)
    );
  }

  return false;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function gmailRequest<T>(
  accessToken: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (!accessToken) {
    throw new Error(
      "Gmail access token is missing.",
    );
  }

  const headers = new Headers(
    options.headers,
  );

  headers.set(
    "Authorization",
    `Bearer ${accessToken}`,
  );

  if (
    options.body &&
    !headers.has("Content-Type")
  ) {
    headers.set(
      "Content-Type",
      "application/json",
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    GMAIL_REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(
      `${GMAIL_API_BASE}${path}`,
      {
        ...options,
        headers,
        cache: "no-store",
        signal: controller.signal,
      },
    );

    if (response.status === 401) {
      throw new Error(
        "GMAIL_AUTH_EXPIRED",
      );
    }

    if (!response.ok) {
      const message =
        await parseGoogleError(response);

      throw new Error(
        `GMAIL_API_ERROR: ${message}`,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(
        `GMAIL_NETWORK_TIMEOUT: Gmail request timed out after ${GMAIL_REQUEST_TIMEOUT_MS / 1000} seconds.`,
      );
    }

    const message = getErrorMessage(error);

    if (
      /fetch failed|connect timeout|network|econn|enotfound|etimedout|socket/i.test(
        message,
      )
    ) {
      throw new Error(
        `GMAIL_NETWORK_ERROR: ${message}`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getGmailProfile(
  accessToken: string,
): Promise<GmailProfile> {
  return gmailRequest<GmailProfile>(
    accessToken,
    "/profile",
  );
}

export async function listGmailMessages(
  accessToken: string,
  options: {
    maxResults?: number;
    pageToken?: string;
    q?: string;
    labelIds?: string[];
  } = {},
): Promise<GmailListResponse> {
  const params =
    new URLSearchParams();

  const maxResults = Math.min(
    Math.max(
      Number.isFinite(
        options.maxResults ?? 20,
      )
        ? Math.floor(
            options.maxResults ?? 20,
          )
        : 20,
      1,
    ),
    500,
  );

  params.set(
    "maxResults",
    String(maxResults),
  );

  if (options.pageToken) {
    params.set(
      "pageToken",
      options.pageToken,
    );
  }

  if (options.q) {
    params.set("q", options.q);
  }

  if (
    options.labelIds &&
    options.labelIds.length > 0
  ) {
    for (const labelId of options.labelIds) {
      params.append(
        "labelIds",
        labelId,
      );
    }
  }

  return gmailRequest<GmailListResponse>(
    accessToken,
    `/messages?${params.toString()}`,
  );
}

export async function getGmailMessage(
  accessToken: string,
  messageId: string,
): Promise<GmailMessage> {
  if (!messageId) {
    throw new Error(
      "Gmail message ID is required.",
    );
  }

  const params =
    new URLSearchParams();

  params.set("format", "full");

  return gmailRequest<GmailMessage>(
    accessToken,
    `/messages/${encodeURIComponent(
      messageId,
    )}?${params.toString()}`,
  );
}

function decodeBase64Url(
  value: string,
): string {
  if (!value) {
    return "";
  }

  const normalized =
    value
      .replace(/-/g, "+")
      .replace(/_/g, "/");

  const padding =
    normalized.length % 4;

  const padded =
    padding === 0
      ? normalized
      : normalized +
        "=".repeat(
          4 - padding,
        );

  try {
    return Buffer.from(
      padded,
      "base64",
    ).toString("utf8");
  } catch {
    return "";
  }
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function getHeader(
  headers:
    | GmailMessageHeader[]
    | undefined,
  name: string,
): string {
  const target =
    name.toLowerCase();

  const header =
    headers?.find(
      (item) =>
        item.name.toLowerCase() ===
        target,
    );

  return header?.value ?? "";
}

function collectBodyParts(
  part: GmailMessagePart | undefined,
  result: {
    plain: string[];
    html: string[];
  },
): void {
  if (!part) {
    return;
  }

  const mimeType =
    part.mimeType?.toLowerCase() ?? "";

  const bodyData =
    part.body?.data;

  if (
    bodyData &&
    mimeType === "text/plain"
  ) {
    const text =
      decodeBase64Url(bodyData);

    if (text) {
      result.plain.push(text);
    }
  }

  if (
    bodyData &&
    mimeType === "text/html"
  ) {
    const html =
      decodeBase64Url(bodyData);

    if (html) {
      result.html.push(html);
    }
  }

  if (
    part.parts &&
    part.parts.length > 0
  ) {
    for (const child of part.parts) {
      collectBodyParts(
        child,
        result,
      );
    }
  }
}

export function extractGmailMessageContent(
  message: GmailMessage,
): {
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
} {
  const headers =
    message.payload?.headers ?? [];

  const result = {
    plain: [] as string[],
    html: [] as string[],
  };

  collectBodyParts(
    message.payload,
    result,
  );

  const bodyText =
    result.plain.join("\n\n");

  const bodyHtml =
    result.html.join("\n");

  return {
    from: getHeader(
      headers,
      "From",
    ),
    to: getHeader(
      headers,
      "To",
    ),
    cc: getHeader(
      headers,
      "Cc",
    ),
    bcc: getHeader(
      headers,
      "Bcc",
    ),
    replyTo: getHeader(
      headers,
      "Reply-To",
    ),
    subject: getHeader(
      headers,
      "Subject",
    ),
    date: getHeader(
      headers,
      "Date",
    ),
    messageId: getHeader(
      headers,
      "Message-ID",
    ),
    bodyText,
    bodyHtml,
  };
}

function createMimeMessage({
  to,
  subject,
  body,
  cc,
  bcc,
  inReplyTo,
  references,
}: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const lines: string[] = [];

  lines.push(
    `To: ${to}`,
  );

  if (cc) {
    lines.push(
      `Cc: ${cc}`,
    );
  }

  if (bcc) {
    lines.push(
      `Bcc: ${bcc}`,
    );
  }

  lines.push(
    `Subject: ${subject}`,
  );

  if (inReplyTo) {
    lines.push(
      `In-Reply-To: ${inReplyTo}`,
    );
  }

  if (references) {
    lines.push(
      `References: ${references}`,
    );
  }

  lines.push(
    "MIME-Version: 1.0",
  );
  lines.push(
    "Content-Type: text/plain; charset=UTF-8",
  );
  lines.push(
    "Content-Transfer-Encoding: 8bit",
  );
  lines.push("");
  lines.push(body);

  return lines.join("\r\n");
}

export async function sendGmailMessage({
  accessToken,
  to,
  subject,
  body,
  cc,
  bcc,
}: {
  accessToken: string;
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
}): Promise<GmailMessage> {
  if (!to.trim()) {
    throw new Error(
      "Recipient email is required.",
    );
  }

  if (!subject.trim()) {
    throw new Error(
      "Email subject is required.",
    );
  }

  if (!body.trim()) {
    throw new Error(
      "Email body is required.",
    );
  }

  const raw =
    createMimeMessage({
      to: to.trim(),
      subject: subject.trim(),
      body,
      cc: cc?.trim(),
      bcc: bcc?.trim(),
    });

  return gmailRequest<GmailMessage>(
    accessToken,
    "/messages/send",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        raw: encodeBase64Url(raw),
      }),
    },
  );
}

export async function replyToGmailThread({
  accessToken,
  threadId,
  messageId,
  to,
  subject,
  body,
  cc,
  references,
}: {
  accessToken: string;
  threadId: string;
  messageId?: string;
  to: string;
  subject: string;
  body: string;
  cc?: string;
  references?: string;
}): Promise<GmailMessage> {
  if (!threadId) {
    throw new Error(
      "Gmail thread ID is required.",
    );
  }

  if (!to.trim()) {
    throw new Error(
      "Recipient email is required.",
    );
  }

  if (!body.trim()) {
    throw new Error(
      "Reply body is required.",
    );
  }

  const normalizedSubject =
    /^re:/i.test(subject.trim())
      ? subject.trim()
      : `Re: ${subject.trim()}`;

  const raw =
    createMimeMessage({
      to: to.trim(),
      subject:
        normalizedSubject,
      body,
      cc: cc?.trim(),
      inReplyTo:
        messageId?.trim(),
      references:
        references?.trim(),
    });

  return gmailRequest<GmailMessage>(
    accessToken,
    "/messages/send",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        raw: encodeBase64Url(raw),
        threadId,
      }),
    },
  );
}