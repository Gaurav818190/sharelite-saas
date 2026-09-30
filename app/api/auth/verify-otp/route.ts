import { NextResponse } from "next/server";

import { getConfig } from "@/lib/supabase-auth";

import {
  checkRateLimit,
  getClientKey,
  rateLimitResponse,
} from "@/lib/rate-limit";

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(
    getClientKey(request, "auth-verify-otp"),
    10,
  );

  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit);
  }

  const body = await request
    .json()
    .catch(() => null);

  const email =
    typeof body?.email === "string"
      ? body.email.trim().toLowerCase()
      : "";

  const otp =
    typeof body?.otp === "string"
      ? body.otp.trim()
      : "";

  if (
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email,
    ) ||
    !/^\d{6}$/.test(otp)
  ) {
    return NextResponse.json(
      {
        error:
          "Valid email and 6-digit OTP are required.",
      },
      { status: 400 },
    );
  }

  try {
    const { url, key } = getConfig();

    const response = await fetch(
      `${url}/auth/v1/verify`,
      {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "signup",
          email,
          token: otp,
        }),
        cache: "no-store",
      },
    );

    const payload = await response
      .json()
      .catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            payload?.msg ||
            payload?.error_description ||
            payload?.error ||
            "Invalid or expired OTP.",
        },
        {
          status:
            response.status >= 400 &&
            response.status < 500
              ? response.status
              : 502,
        },
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Email verified successfully. You can now sign in.",
    });
  } catch (error) {
    console.error(
      "ShareLite OTP verification failed:",
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