import { NextResponse } from "next/server";
import {
  accessCookie,
  refreshCookie,
  getConfig,
} from "@/lib/supabase-auth";
import {
  checkRateLimit,
  getClientKey,
  rateLimitResponse,
} from "@/lib/rate-limit";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(
    getClientKey(request, "auth-login"),
    10,
  );

  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit);
  }

  const body = await request.json().catch(() => null);

  const email =
    typeof body?.email === "string"
      ? body.email.trim().toLowerCase()
      : "";

  const password =
    typeof body?.password === "string"
      ? body.password
      : "";

  if (!email || !isValidEmail(email) || !password) {
    return NextResponse.json(
      {
        error: "Please enter a valid email and password.",
      },
      { status: 400 },
    );
  }

  try {
    const { url, key } = getConfig();

    const response = await fetch(
      `${url}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
        cache: "no-store",
      },
    );

    const session = await response
      .json()
      .catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            "Invalid email or password, or your email has not been verified yet.",
        },
        { status: 401 },
      );
    }

    if (
      typeof session?.access_token !== "string" ||
      typeof session?.refresh_token !== "string"
    ) {
      return NextResponse.json(
        {
          error:
            "Please verify your email before signing in.",
        },
        { status: 401 },
      );
    }

    const result = NextResponse.json({
      ok: true,
    });

    const secure =
      process.env.NODE_ENV === "production";

    result.cookies.set(
      accessCookie,
      session.access_token,
      {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: session.expires_in ?? 3600,
      },
    );

    result.cookies.set(
      refreshCookie,
      session.refresh_token,
      {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      },
    );

    return result;
  } catch (error) {
    console.error(
      "ShareLite login request failed:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Authentication service is unavailable.",
      },
      { status: 503 },
    );
  }
}