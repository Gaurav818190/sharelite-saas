import { NextResponse } from "next/server";

import { getConfig } from "@/lib/supabase-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const email =
    typeof body?.email === "string"
      ? body.email.trim().toLowerCase()
      : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  try {
    const { url, key } = getConfig();

    const response = await fetch(`${url}/auth/v1/resend`, {
      method: "POST",
      headers: {
        apikey: key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "signup",
        email,
      }),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            payload?.msg ||
            payload?.message ||
            payload?.error_description ||
            payload?.error ||
            "Unable to resend OTP.",
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "A new 6-digit OTP has been sent to your email.",
    });
  } catch (error) {
    console.error("ShareLite resend OTP failed:", error);

    return NextResponse.json(
      {
        error: "Authentication service is unavailable.",
      },
      { status: 503 }
    );
  }
}