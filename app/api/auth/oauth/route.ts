import { NextResponse } from "next/server";
import { getConfig } from "@/lib/supabase-auth";

const providers = new Set(["google", "github"]);

export async function GET(request: Request) {
  const provider = new URL(request.url).searchParams.get("provider") ?? "";
  if (!providers.has(provider)) return NextResponse.json({ error: "Unsupported sign-in provider." }, { status: 400 });
  try {
    const { url, key } = getConfig();
    const redirectTo = new URL("/api/auth/oauth/callback", request.url).toString();
    const response = await fetch(`${url}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirectTo)}`, { headers: { apikey: key }, cache: "no-store" });
    if (!response.ok) return NextResponse.json({ error: "Unable to start social sign-in." }, { status: 502 });
    const location = response.url;
    return NextResponse.redirect(location);
  } catch { return NextResponse.json({ error: "Authentication service is unavailable." }, { status: 503 }); }
}
