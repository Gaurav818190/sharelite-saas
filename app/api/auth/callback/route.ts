import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getConfig } from "@/lib/supabase-auth";

const accessCookie = "sharelite-access-token";
const refreshCookie = "sharelite-refresh-token";

function safeNextPath(value: string | null): string {
  if (!value) {
    return "/account-setup";
  }

  if (
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/account-setup";
  }

  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);

  const tokenHash =
    requestUrl.searchParams.get("token_hash");

  const typeParam =
    requestUrl.searchParams.get("type");

  const next = safeNextPath(
    requestUrl.searchParams.get("next"),
  );

  const errorUrl = new URL(
    "/login?error=verification_failed",
    requestUrl.origin,
  );

  if (!tokenHash || !typeParam) {
    return NextResponse.redirect(errorUrl);
  }

  const allowedTypes: EmailOtpType[] = [
    "email",
    "signup",
    "invite",
    "magiclink",
    "recovery",
    "email_change",
  ];

  if (
    !allowedTypes.includes(
      typeParam as EmailOtpType,
    )
  ) {
    return NextResponse.redirect(errorUrl);
  }

  try {
    const { url, key } = getConfig();

    const supabase = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { data, error } =
      await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: typeParam as EmailOtpType,
      });

    if (
      error ||
      !data.session ||
      !data.user
    ) {
      console.error(
        "ShareLite email verification failed:",
        error,
      );

      return NextResponse.redirect(errorUrl);
    }

    const redirectUrl = new URL(
      next,
      requestUrl.origin,
    );

    const response =
      NextResponse.redirect(redirectUrl);

    const secure =
      process.env.NODE_ENV === "production";

    response.cookies.set(
      accessCookie,
      data.session.access_token,
      {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge:
          data.session.expires_in ?? 3600,
      },
    );

    response.cookies.set(
      refreshCookie,
      data.session.refresh_token,
      {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      },
    );

    return response;
  } catch (error) {
    console.error(
      "ShareLite verification callback error:",
      error,
    );

    return NextResponse.redirect(errorUrl);
  }
}