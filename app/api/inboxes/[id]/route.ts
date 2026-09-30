import { NextResponse } from "next/server";

import { requireAuthenticatedUser } from "@/lib/supabase-db";

type Context = {
  params: Promise<{ id: string }>;
};

type UpdateInput = {
  status: "active" | "paused";
};

function parseInput(value: unknown): UpdateInput | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const body = value as Record<string, unknown>;

  if (body.status !== "active" && body.status !== "paused") {
    return null;
  }

  return {
    status: body.status,
  };
}

async function updateInbox(
  accessToken: string,
  userId: string,
  inboxId: string,
  status: UpdateInput["status"],
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase environment is not configured.");
  }

  const response = await fetch(
    `${url}/rest/v1/connected_inboxes?id=eq.${encodeURIComponent(
      inboxId,
    )}&user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        status,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const message = await response.text().catch(() => "");

    throw new Error(
      message || "Unable to update connected inbox.",
    );
  }

  const rows = await response.json();

  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function PATCH(
  request: Request,
  context: Context,
) {
  try {
    const { user, accessToken } =
      await requireAuthenticatedUser();

    const { id } = await context.params;

    if (!id || id.length > 100) {
      return NextResponse.json(
        { error: "Invalid inbox ID." },
        { status: 400 },
      );
    }

    const input = parseInput(
      await request.json().catch(() => null),
    );

    if (!input) {
      return NextResponse.json(
        {
          error:
            'Status must be either "active" or "paused".',
        },
        { status: 400 },
      );
    }

    const inbox = await updateInbox(
      accessToken,
      user.id,
      id,
      input.status,
    );

    if (!inbox) {
      return NextResponse.json(
        { error: "Connected inbox not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      inbox,
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
      { error: "Unable to update connected inbox." },
      { status: 500 },
    );
  }
}