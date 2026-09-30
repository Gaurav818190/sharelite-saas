import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/supabase-db";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuthenticatedUser();
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Inbox ID is required." },
        { status: 400 }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Supabase server configuration is missing." },
        { status: 500 }
      );
    }

    const query = new URLSearchParams({
      id: `eq.${id}`,
      user_id: `eq.${auth.user.id}`,
    });

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/connected_inboxes?${query.toString()}`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          status: "disconnected",
          updated_at: new Date().toISOString(),
        }),
      }
    );

    if (!response.ok) {
      const details = await response.text().catch(() => "");

      console.error(
        "Disconnect inbox failed:",
        response.status,
        details
      );

      return NextResponse.json(
        { error: "Unable to disconnect Gmail inbox." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Gmail inbox disconnected successfully.",
    });
  } catch (error) {
    console.error("Disconnect inbox error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to disconnect Gmail inbox.",
      },
      { status: 500 }
    );
  }
}
