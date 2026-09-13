import { NextResponse } from "next/server";
import { accessCookie, refreshCookie, getConfig } from "@/lib/supabase-auth";
import { checkRateLimit, getClientKey, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(getClientKey(request, "auth-signup"), 5);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
  const body = await request.json().catch(() => null);
  const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!firstName || firstName.length > 100 || lastName.length > 100 || !email || password.length < 8) {
    return NextResponse.json({ error: "First name, valid email, and password of at least 8 characters are required." }, { status: 400 });
  }

  try {
    const { url, key } = getConfig();
    const response = await fetch(`${url}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, data: { first_name: firstName, last_name: lastName, name: firstName } }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      console.error("ShareLite signup failed", {
        status: response.status,
        error: payload?.error,
        errorCode: payload?.error_code,
        message: payload?.msg,
      });
      const error = payload?.msg ?? payload?.error ?? "Unable to create account.";
      return NextResponse.json({ error }, { status: response.status >= 400 && response.status < 500 ? response.status : 502 });
    }

    const result = NextResponse.json({ requiresEmailConfirmation: !payload?.access_token });
    if (payload?.access_token && payload?.refresh_token) {
      const secure = process.env.NODE_ENV === "production";
      result.cookies.set(accessCookie, payload.access_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: payload.expires_in ?? 3600 });
      result.cookies.set(refreshCookie, payload.refresh_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    }
    return result;
  } catch (error) {
    console.error("ShareLite signup request failed", error);
    return NextResponse.json({ error: "Authentication service is unavailable." }, { status: 503 });
  }
}
