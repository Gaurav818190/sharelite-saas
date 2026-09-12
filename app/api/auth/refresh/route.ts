import { NextResponse } from "next/server";
import {
  accessCookie,
  getRefreshToken,
  getSessionCookieOptions,
  refreshCookie,
  refreshSession,
} from "@/lib/supabase-auth";

export async function POST() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    const session = await refreshSession(refreshToken);
    if (!session) {
      const response = NextResponse.json({ error: "Authentication required." }, { status: 401 });
      response.cookies.delete(accessCookie);
      response.cookies.delete(refreshCookie);
      return response;
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(accessCookie, session.accessToken, getSessionCookieOptions(session.expiresIn));
    response.cookies.set(refreshCookie, session.refreshToken, getSessionCookieOptions(60 * 60 * 24 * 30));
    return response;
  } catch {
    return NextResponse.json({ error: "Authentication service is unavailable." }, { status: 503 });
  }
}
