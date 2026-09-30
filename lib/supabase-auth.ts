import { cookies } from "next/headers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const accessCookie = "sharelite-access-token";
const refreshCookie = "sharelite-refresh-token";

function baseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    throw new Error("Supabase authentication is not configured.");
  }

  return url.replace(/\/+$/, "");
}

function getAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key) {
    throw new Error("Supabase authentication is not configured.");
  }

  return key;
}

export function getConfig() {
  return {
    url: baseUrl(),
    key: getAnonKey(),
  };
}

export function getServiceRoleConfig() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error("Supabase service operations are not configured.");
  }

  return {
    url: baseUrl(),
    key,
  };
}

export type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export type AuthSession = {
  user: AuthUser;
  accessToken: string;
};

export type RefreshedSession = AuthSession & {
  refreshToken: string;
  expiresIn: number;
};

export function createSupabaseBrowserClient() {
  return createClient(baseUrl(), getAnonKey());
}

export function createSupabaseServerClient(): SupabaseClient {
  return createClient(baseUrl(), getAnonKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function getCurrentSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(accessCookie)?.value;

  if (!accessToken) {
    return null;
  }

  const { url, key } = getConfig();

  const response = await fetch(`${url}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const user = await response.json();

  return {
    user,
    accessToken,
  };
}

export async function refreshSession(
  refreshToken: string,
): Promise<RefreshedSession | null> {
  const { url, key } = getConfig();

  const response = await fetch(
    `${url}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        apikey: key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return null;
  }

  const session = await response.json();

  if (
    !session.access_token ||
    !session.refresh_token ||
    !session.user
  ) {
    return null;
  }

  return {
    user: session.user,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresIn: session.expires_in ?? 3600,
  };
}

export function getSessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function getRefreshToken(): Promise<string | null> {
  const cookieStore = await cookies();

  return cookieStore.get(refreshCookie)?.value ?? null;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getCurrentSession();

  return session?.user ?? null;
}

export {
  accessCookie,
  refreshCookie,
};