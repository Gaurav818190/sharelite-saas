import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  decrypt,
  encrypt,
  validateOAuthState,
} from "@/lib/google-oauth";

import {
  exchangeGoogleCode,
  getGmailProfile,
} from "@/lib/gmail";

const ACCESS_TOKEN_COOKIE = "sharelite-access-token";
const OAUTH_STATE_COOKIE = "sharelite-google-oauth-state";

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error(
      "Supabase environment variables are incomplete."
    );
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    anonKey,
  };
}

async function getCurrentUser(accessToken: string) {
  const { supabaseUrl, anonKey } = getSupabaseConfig();

  const response = await fetch(
    `${supabaseUrl}/auth/v1/user`,
    {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");

    console.error(
      "GOOGLE_CALLBACK_USER_ERROR:",
      response.status,
      errorText
    );

    return null;
  }

  return response.json();
}

async function findExistingInbox(
  userId: string,
  email: string
) {
  const {
    supabaseUrl,
    serviceRoleKey,
  } = getSupabaseConfig();

  const params = new URLSearchParams({
    select:
      "id,user_id,provider,email,access_token,refresh_token,token_expires_at",
    user_id: `eq.${userId}`,
    provider: "eq.google",
    email: `eq.${email}`,
    limit: "1",
  });

  const response = await fetch(
    `${supabaseUrl}/rest/v1/connected_inboxes?${params.toString()}`,
    {
      method: "GET",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");

    console.error(
      "GOOGLE_CALLBACK_FIND_INBOX_ERROR:",
      response.status,
      errorText
    );

    throw new Error(
      `Unable to check existing connected inbox (${response.status}): ${errorText}`
    );
  }

  const rows = await response.json();

  return Array.isArray(rows)
    ? rows[0] ?? null
    : null;
}

async function saveConnectedInbox(input: {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
  existingInbox?: {
    id: string;
    refresh_token: string | null;
  } | null;
}) {
  const {
    supabaseUrl,
    serviceRoleKey,
  } = getSupabaseConfig();

  let refreshToken =
    input.refreshToken;

  if (
    !refreshToken &&
    input.existingInbox?.refresh_token
  ) {
    console.log(
      "GOOGLE_CALLBACK: Google did not return a refresh token. Reusing existing refresh token."
    );

    refreshToken = decrypt(
      input.existingInbox.refresh_token
    );
  }

  if (!refreshToken) {
    throw new Error(
      "Google did not provide a refresh token. Please reconnect the Gmail account with consent."
    );
  }

  const encryptedAccessToken = encrypt(
    input.accessToken
  );

  const encryptedRefreshToken = encrypt(
    refreshToken
  );

  const payload = {
    user_id: input.userId,
    provider: "google",
    email: input.email,
    access_token: encryptedAccessToken,
    refresh_token: encryptedRefreshToken,
    token_expires_at: input.expiresAt,
    status: "active",
    updated_at: new Date().toISOString(),
  };

  /*
   * Existing inbox:
   * update it directly.
   */
  if (input.existingInbox?.id) {
    console.log(
      "GOOGLE_CALLBACK: Updating existing Gmail inbox:",
      input.existingInbox.id
    );

    const response = await fetch(
      `${supabaseUrl}/rest/v1/connected_inboxes?id=eq.${encodeURIComponent(
        input.existingInbox.id
      )}`,
      {
        method: "PATCH",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");

      console.error(
        "CONNECTED_INBOX_UPDATE_ERROR:",
        response.status,
        errorText
      );

      throw new Error(
        `Connected inbox update failed (${response.status}): ${errorText}`
      );
    }

    const rows = await response.json();

    return Array.isArray(rows)
      ? rows[0] ?? null
      : null;
  }

  /*
   * No existing inbox:
   * create a new one.
   */
  console.log(
    "GOOGLE_CALLBACK: Creating new Gmail inbox:",
    input.email
  );

  const response = await fetch(
    `${supabaseUrl}/rest/v1/connected_inboxes`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");

    console.error(
      "CONNECTED_INBOX_INSERT_ERROR:",
      response.status,
      errorText
    );

    throw new Error(
      `Connected inbox insert failed (${response.status}): ${errorText}`
    );
  }

  const rows = await response.json();

  return Array.isArray(rows)
    ? rows[0] ?? null
    : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const receivedState = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const cookieStore = await cookies();

  const storedState = cookieStore.get(
    OAUTH_STATE_COOKIE
  )?.value;

  try {
    console.log(
      "GOOGLE_CALLBACK: Started"
    );

    if (oauthError) {
      console.error(
        "GOOGLE_CALLBACK_OAUTH_ERROR:",
        oauthError
      );

      return NextResponse.redirect(
        new URL(
          "/dashboard?inbox=google_error",
          request.url
        )
      );
    }

    if (!code) {
      console.error(
        "GOOGLE_CALLBACK: Missing authorization code."
      );

      return NextResponse.redirect(
        new URL(
          "/dashboard?inbox=missing_code",
          request.url
        )
      );
    }

    console.log(
      "GOOGLE_CALLBACK: Authorization code received."
    );

    if (
      !validateOAuthState(
        receivedState,
        storedState
      )
    ) {
      console.error(
        "GOOGLE_CALLBACK: OAuth state validation failed."
      );

      return NextResponse.redirect(
        new URL(
          "/dashboard?inbox=invalid_state",
          request.url
        )
      );
    }

    console.log(
      "GOOGLE_CALLBACK: OAuth state validated."
    );

    const accessToken = cookieStore.get(
      ACCESS_TOKEN_COOKIE
    )?.value;

    if (!accessToken) {
      console.error(
        "GOOGLE_CALLBACK: ShareLite access token cookie missing."
      );

      return NextResponse.redirect(
        new URL("/login", request.url)
      );
    }

    const user = await getCurrentUser(
      accessToken
    );

    if (!user?.id) {
      console.error(
        "GOOGLE_CALLBACK: ShareLite user could not be resolved."
      );

      return NextResponse.redirect(
        new URL("/login", request.url)
      );
    }

    console.log(
      "GOOGLE_CALLBACK: ShareLite user verified:",
      user.id
    );

    console.log(
      "GOOGLE_CALLBACK: Exchanging Google authorization code..."
    );

    const googleTokens =
      await exchangeGoogleCode(code);

    if (!googleTokens?.access_token) {
      throw new Error(
        "Google token exchange returned no access token."
      );
    }

    console.log(
      "GOOGLE_CALLBACK: Google access token received."
    );

    console.log(
      "GOOGLE_CALLBACK: Reading Gmail profile..."
    );

    const gmailProfile =
      await getGmailProfile(
        googleTokens.access_token
      );

    const email =
      gmailProfile.emailAddress
        ?.trim()
        .toLowerCase();

    if (!email) {
      throw new Error(
        "Google did not return the Gmail address."
      );
    }

    console.log(
      "GOOGLE_CALLBACK: Gmail account:",
      email
    );

    console.log(
      "GOOGLE_CALLBACK: Checking existing inbox..."
    );

    const existingInbox =
      await findExistingInbox(
        user.id,
        email
      );

    const expiresAt = new Date(
      Date.now() +
        googleTokens.expires_in * 1000
    ).toISOString();

    await saveConnectedInbox({
      userId: user.id,
      email,
      accessToken:
        googleTokens.access_token,
      refreshToken:
        googleTokens.refresh_token ?? null,
      expiresAt,
      existingInbox,
    });

    console.log(
      "GOOGLE_CALLBACK: Gmail inbox saved successfully."
    );

    const response =
      NextResponse.redirect(
        new URL(
          "/dashboard?inbox=google_connected",
          request.url
        )
      );

    response.cookies.set(
      OAUTH_STATE_COOKIE,
      "",
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      }
    );

    return response;
  } catch (error) {
    console.error(
      "GOOGLE_CALLBACK_FAILED:",
      error instanceof Error
        ? error.message
        : String(error)
    );

    const response =
      NextResponse.redirect(
        new URL(
          "/dashboard?inbox=google_error",
          request.url
        )
      );

    response.cookies.set(
      OAUTH_STATE_COOKIE,
      "",
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      }
    );

    return response;
  }
}