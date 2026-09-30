import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function cleanName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function capitalizeName(value: string): string {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getSiteUrl(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const firstName = capitalizeName(cleanName(body?.firstName));
    const lastName = capitalizeName(cleanName(body?.lastName));
    const email = cleanName(body?.email).toLowerCase();
    const password =
      typeof body?.password === "string" ? body.password : "";

    if (!firstName) {
      return NextResponse.json(
        {
          success: false,
          message: "First name is required.",
        },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        {
          success: false,
          message: "Please enter a valid email address.",
        },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          message: "Password must be at least 8 characters.",
        },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("Supabase environment variables are missing.");

      return NextResponse.json(
        {
          success: false,
          message: "Authentication service is unavailable.",
        },
        { status: 500 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const siteUrl = getSiteUrl(request);

    const redirectTo =
      `${siteUrl}/auth/callback?next=/account-setup`;

    const fullName = `${firstName} ${lastName}`.trim();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          first_name: firstName,
          last_name: lastName,
          name: fullName,
          full_name: fullName,
        },
      },
    });

    if (error) {
      console.error("Supabase signup error:", error);

      return NextResponse.json(
        {
          success: false,
          message: error.message,
          code: error.code ?? null,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      requiresEmailConfirmation: !data.session,
      email,
      firstName,
      lastName,
      message: data.session
        ? "Account created successfully."
        : "Account created. Please check your email and click the confirmation link.",
    });
  } catch (error) {
    console.error("Signup error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong while creating your account.",
      },
      { status: 500 }
    );
  }
}