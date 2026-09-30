import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  buildGoogleOAuthUrl,
  generateOAuthState,
} from "@/lib/google-oauth";

const ACCESS_TOKEN_COOKIE = "sharelite-access-token";
const OAUTH_STATE_COOKIE = "sharelite-google-oauth-state";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();

    const accessToken = cookieStore.get(
      ACCESS_TOKEN_COOKIE
    )?.value;

    if (!accessToken) {
      return NextResponse.redirect(
        new URL("/login", request.url)
      );
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error(
        "Supabase environment variables are missing."
      );

      return NextResponse.json(
        {
          error:
            "Authentication service is not configured.",
        },
        { status: 500 }
      );
    }

    const userResponse = await fetch(
      `${supabaseUrl}/auth/v1/user`,
      {
        method: "GET",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    if (!userResponse.ok) {
      return NextResponse.redirect(
        new URL("/login", request.url)
      );
    }

    const user = await userResponse.json();

    if (!user?.id || !user?.email) {
      return NextResponse.redirect(
        new URL("/login", request.url)
      );
    }

    const state = generateOAuthState();

    const response = NextResponse.redirect(
      buildGoogleOAuthUrl(state)
    );

    response.cookies.set(
      OAUTH_STATE_COOKIE,
      state,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 10 * 60,
      }
    );

    return response;
  } catch (error) {
    console.error(
      "Google OAuth connect route failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to start Google connection.",
      },
      { status: 500 }
    );
  }
}