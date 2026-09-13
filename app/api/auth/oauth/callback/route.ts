import { NextResponse } from "next/server";
import { accessCookie, getConfig, refreshCookie, getSessionCookieOptions } from "@/lib/supabase-auth";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  try {
    const { url, key } = getConfig();
    const response = await fetch(`${url}/auth/v1/token?grant_type=pkce`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ auth_code: code }), cache: "no-store" });
    const session = await response.json().catch(() => null);
    if (!response.ok || !session?.access_token || !session?.refresh_token) return NextResponse.redirect(new URL("/login?error=oauth", request.url));
    const result = NextResponse.redirect(new URL("/", request.url));
    result.cookies.set(accessCookie, session.access_token, getSessionCookieOptions(session.expires_in ?? 3600));
    result.cookies.set(refreshCookie, session.refresh_token, getSessionCookieOptions(60 * 60 * 24 * 30));
    return result;
  } catch { return NextResponse.redirect(new URL("/login?error=oauth", request.url)); }
}
