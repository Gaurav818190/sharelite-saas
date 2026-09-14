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

function cleanName(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 100);
}

function capitalizeName(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => {
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(
    getClientKey(request, "auth-signup"),
    5
  );

  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit);
  }

  const body = await request.json().catch(() => null);

  const firstName = capitalizeName(cleanName(body?.firstName));
  const lastName = capitalizeName(cleanName(body?.lastName));

  const email =
    typeof body?.email === "string"
      ? body.email.trim().toLowerCase()
      : "";

  const password =
    typeof body?.password === "string"
      ? body.password
      : "";

  if (
    !firstName ||
    firstName.length > 100 ||
    lastName.length > 100 ||
    !email ||
    password.length < 8
  ) {
    return NextResponse.json(
      {
        error:
          "First name, valid email, and password of at least 8 characters are required.",
      },
      { status: 400 }
    );
  }

  const fullName = `${firstName} ${lastName}`.trim();

  try {
    const { url, key } = getConfig();

    const response = await fetch(`${url}/auth/v1/signup`, {
      method: "POST",
      headers: {
        apikey: key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        data: {
          first_name: firstName,
          last_name: lastName,
          name: fullName,
          full_name: fullName,
        },
      }),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      console.error("ShareLite signup failed:", {
        status: response.status,
        payload,
      });

      const errorMessage =
        payload?.msg ||
        payload?.message ||
        payload?.error_description ||
        payload?.error ||
        "Unable to create account.";

      return NextResponse.json(
        {
          error: errorMessage,
          code: payload?.error_code || null,
        },
        {
          status:
            response.status >= 400 && response.status < 500
              ? response.status
              : 502,
        }
      );
    }

    const result = NextResponse.json({
      success: true,
      requiresEmailConfirmation: !payload?.access_token,
      email,
      firstName,
    });

    if (payload?.access_token && payload?.refresh_token) {
      const secure = process.env.NODE_ENV === "production";

      result.cookies.set(accessCookie, payload.access_token, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: payload.expires_in ?? 3600,
      });

      result.cookies.set(refreshCookie, payload.refresh_token, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return result;
  } catch (error) {
    console.error("ShareLite signup request failed:", error);

    return NextResponse.json(
      {
        error: "Authentication service is unavailable.",
      },
      { status: 503 }
    );
  }
}