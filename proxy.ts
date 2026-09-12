import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { accessCookie, getConfig, getSessionCookieOptions, refreshCookie } from "@/lib/supabase-auth";

function accessTokenExpiresAt(token: string) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: unknown };
    return typeof decoded.exp === "number" ? decoded.exp : null;
  } catch {
    return null;
  }
}

function shouldRefresh(accessToken: string | undefined) {
  if (!accessToken) return true;
  const expiresAt = accessTokenExpiresAt(accessToken);
  return expiresAt === null || expiresAt <= Math.floor(Date.now() / 1000) + 30;
}

export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get(accessCookie)?.value;
  const refreshToken = request.cookies.get(refreshCookie)?.value;
  if (!refreshToken || !shouldRefresh(accessToken)) return NextResponse.next();

  const response = NextResponse.next({ request });
  try {
    const { url, key } = getConfig();
    const refreshed = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });
    if (!refreshed.ok) {
      response.cookies.delete(accessCookie);
      response.cookies.delete(refreshCookie);
      return response;
    }

    const session = await refreshed.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!session.access_token || !session.refresh_token) {
      response.cookies.delete(accessCookie);
      response.cookies.delete(refreshCookie);
      return response;
    }

    request.cookies.set(accessCookie, session.access_token);
    request.cookies.set(refreshCookie, session.refresh_token);
    response.cookies.set(accessCookie, session.access_token, getSessionCookieOptions(session.expires_in ?? 3600));
    response.cookies.set(refreshCookie, session.refresh_token, getSessionCookieOptions(60 * 60 * 24 * 30));
    return response;
  } catch {
    return response;
  }
}

export const config = {
  matcher: ["/", "/api/((?!auth/login|auth/signup|auth/logout|auth/refresh).*)"],
};
