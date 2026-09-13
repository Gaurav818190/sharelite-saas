import { cookies } from "next/headers";

const accessCookie = "sharelite-access-token";
const refreshCookie = "sharelite-refresh-token";

function baseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Supabase authentication is not configured.");
  return url.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

function getConfig() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error("Supabase authentication is not configured.");
  return { url: baseUrl(), key };
}

export function getServiceRoleConfig() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Supabase service operations are not configured.");
  return { url: baseUrl(), key };
}

export type AuthUser = { id: string; email?: string };

export type AuthSession = { user: AuthUser; accessToken: string };
export type RefreshedSession = AuthSession & { refreshToken: string; expiresIn: number };

export async function getCurrentSession(): Promise<AuthSession | null> {
  const store = await cookies();
  const access = store.get(accessCookie)?.value;
  if (!access) return null;
  const { url, key } = getConfig();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${access}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return { user: await response.json(), accessToken: access };
}

export async function refreshSession(refreshToken: string): Promise<RefreshedSession | null> {
  const { url, key } = getConfig();
  const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const session = await response.json();
  if (!session.access_token || !session.refresh_token || !session.user) return null;
  return { user: session.user, accessToken: session.access_token, refreshToken: session.refresh_token, expiresIn: session.expires_in ?? 3600 };
}

export function getSessionCookieOptions(maxAge: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge };
}

export async function getRefreshToken(): Promise<string | null> {
  return (await cookies()).get(refreshCookie)?.value ?? null;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  return (await getCurrentSession())?.user ?? null;
}

export { accessCookie, refreshCookie, getConfig };
