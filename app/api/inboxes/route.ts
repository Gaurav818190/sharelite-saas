import { NextResponse } from "next/server";

import { requireAuthenticatedUser } from "@/lib/supabase-db";

type ConnectedInbox = {
  id: string;
  email: string;
  display_name: string | null;
  provider: "google" | "smtp";
  status: "active" | "paused" | "disconnected";
  daily_send_limit: number;
  daily_sent_count: number;
  daily_count_date: string;
  last_sent_at: string | null;
  created_at: string;
};

async function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase environment is not configured.");
  }

  return { url, anonKey };
}

async function supabaseRequest(
  accessToken: string,
  path: string,
  options: RequestInit = {},
) {
  const { url, anonKey } = await getSupabaseConfig();

  const headers = new Headers(options.headers);
  headers.set("apikey", anonKey);
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Content-Type", "application/json");

  return fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });
}

export async function GET() {
  try {
    const { user, accessToken } =
      await requireAuthenticatedUser();

    const response = await supabaseRequest(
      accessToken,
      `connected_inboxes?select=id,email,display_name,provider,status,daily_send_limit,daily_sent_count,daily_count_date,last_sent_at,created_at&user_id=eq.${encodeURIComponent(user.id)}&order=created_at.desc`,
    );

    if (!response.ok) {
      const message = await response.text().catch(() => "");

      return NextResponse.json(
        {
          error:
            message || "Unable to load connected inboxes.",
        },
        { status: 500 },
      );
    }

    const inboxes =
      (await response.json()) as ConnectedInbox[];

    return NextResponse.json({
      inboxes,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "UNAUTHENTICATED"
    ) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: "Unable to load connected inboxes." },
      { status: 500 },
    );
  }
}