import { NextResponse } from "next/server";
import {
  accessCookie,
  refreshCookie,
  getConfig,
} from "@/lib/supabase-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const email =
    typeof body?.email === "string"
      ? body.email.trim()
      : "";

  const otp =
    typeof body?.otp === "string"
      ? body.otp.trim()
      : "";

  if (!email || !/^\d{6}$/.test(otp)) {
    return NextResponse.json(
      { error: "Valid email and 6-digit OTP are required." },
      { status: 400 }
    );
  }

  try {
    const { url, key } = getConfig();

    const response = await fetch(`${url}/auth/v1/verify`, {
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
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            payload?.msg ||
            payload?.error_description ||
            payload?.error ||
            "Invalid or expired OTP.",
        },
        { status: response.status }
      );
    }

    const result = NextResponse.json({
      message: "Email verified successfully.",
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
    console.error("ShareLite OTP verification failed", error);

    return NextResponse.json(
      { error: "Authentication service is unavailable." },
      { status: 503 }
    );
  }
}