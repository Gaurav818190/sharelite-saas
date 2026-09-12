import { NextResponse } from "next/server";
import { accessCookie, refreshCookie, getConfig } from "@/lib/supabase-auth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  const access = request.headers.get("cookie")?.match(new RegExp(`${accessCookie}=([^;]+)`))?.[1];
  if (access) {
    try {
      const { url, key } = getConfig();
      await fetch(`${url}/auth/v1/logout`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${access}` } });
    } catch {
      // Cookies are cleared even if the upstream revocation request fails.
    }
  }
  response.cookies.delete(accessCookie);
  response.cookies.delete(refreshCookie);
  return response;
}
