import { NextResponse } from "next/server";

import {
  getLead,
  requireAuthenticatedUser,
  updateLeadValidation,
} from "@/lib/supabase-db";

import {
  getCurrentEntitlements,
  hasCapacity,
} from "@/lib/monetization";

import { validateEmailAddress } from "@/lib/email-validation";

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(
  _request: Request,
  context: Context,
) {
  try {
    const { id } = await context.params;

    const { user, accessToken } =
      await requireAuthenticatedUser();

    const lead = await getLead(
      accessToken,
      id,
    );

    if (!lead || lead.user_id !== user.id) {
      return NextResponse.json(
        { error: "Lead not found." },
        { status: 404 },
      );
    }

    const entitlements =
      await getCurrentEntitlements(
        accessToken,
        user.id,
      );

    if (
      !hasCapacity(
        entitlements.plan,
        "validation",
        entitlements.usage.validation,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Validation limit reached for your plan.",
        },
        { status: 403 },
      );
    }

    const result =
      await validateEmailAddress(
        lead.email,
      );

    const updatedLead =
      await updateLeadValidation(
        accessToken,
        id,
        result.status,
        result.reason,
      );

    if (!updatedLead) {
      return NextResponse.json(
        { error: "Lead not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      validation: result,
      lead: updatedLead,
    });
  } catch (error) {
    const unauthenticated =
      error instanceof Error &&
      error.message === "UNAUTHENTICATED";

    return NextResponse.json(
      {
        error: unauthenticated
          ? "Authentication required."
          : "Unable to validate lead email.",
      },
      {
        status: unauthenticated ? 401 : 500,
      },
    );
  }
}