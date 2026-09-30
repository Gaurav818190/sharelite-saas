import { NextResponse } from "next/server";

import {
  getLead,
  requireAuthenticatedUser,
} from "@/lib/supabase-db";

import {
  checkRateLimit,
  getClientKey,
  rateLimitResponse,
} from "@/lib/rate-limit";

import {
  consumeAiGeneration,
  releaseAiGeneration,
} from "@/lib/monetization";

import {
  AiProviderRateLimitError,
  AiProviderTemporaryError,
  AiProviderUnavailableError,
  generatePersonalizedMessage,
  isAiProviderConfigured,
} from "@/lib/ai-personalization";

type Context = {
  params: Promise<{ id: string }>;
};

type AiMessageInput = {
  goal: string;
  tone: "professional" | "friendly" | "concise";
  instructions?: string;
};

function parseInput(
  value: unknown,
): AiMessageInput | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const body = value as Record<string, unknown>;

  const goal =
    typeof body.goal === "string"
      ? body.goal.trim()
      : "";

  const tone =
    body.tone === "professional" ||
    body.tone === "friendly" ||
    body.tone === "concise"
      ? body.tone
      : null;

  const instructions =
    typeof body.instructions === "string"
      ? body.instructions.trim()
      : undefined;

  if (!goal || goal.length > 500) {
    return null;
  }

  if (!tone) {
    return null;
  }

  if (
    instructions !== undefined &&
    instructions.length > 2000
  ) {
    return null;
  }

  return {
    goal,
    tone,
    instructions,
  };
}

export async function POST(
  request: Request,
  context: Context,
) {
  const rateLimit = checkRateLimit(
    getClientKey(request, "ai-message"),
    20,
  );

  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit);
  }

  let accessToken = "";
  let aiQuotaConsumed = false;

  try {
    const { accessToken: token } =
      await requireAuthenticatedUser();

    accessToken = token;

    const { id: leadId } = await context.params;

    const input = parseInput(
      await request.json().catch(() => null),
    );

    if (!input) {
      return NextResponse.json(
        {
          error:
            "A valid goal, tone, and optional instructions are required.",
        },
        { status: 400 },
      );
    }

    const lead = await getLead(
      accessToken,
      leadId,
    );

    if (!lead) {
      return NextResponse.json(
        {
          error: "Lead not found.",
        },
        { status: 404 },
      );
    }

    /*
     * Server-side protection:
     * AI generation is allowed only for leads whose
     * email validation status is confirmed as valid.
     */
    if (lead.validation_status !== "valid") {
      return NextResponse.json(
        {
          error:
            "This lead email is not verified as valid. Validate the lead before generating an AI email.",
          validationStatus:
            lead.validation_status ?? "unknown",
        },
        { status: 409 },
      );
    }

    if (!isAiProviderConfigured()) {
      return NextResponse.json(
        {
          error:
            "AI generation is not configured.",
        },
        { status: 503 },
      );
    }

    const consumed =
      await consumeAiGeneration(
        accessToken,
      );

    if (!consumed) {
      return NextResponse.json(
        {
          error:
            "AI generation limit reached for your plan.",
        },
        { status: 403 },
      );
    }

    aiQuotaConsumed = true;

    const result =
  await generatePersonalizedMessage(
    lead,
    {
      goal: input.goal,
      tone: input.tone,
      instructions: input.instructions,
    },
  );

  
    return NextResponse.json({
      success: true,
      subject: result.subject,
      message: result.message,
      provider: result.provider,
    });
  } catch (error) {
    if (
      aiQuotaConsumed &&
      accessToken
    ) {
      await releaseAiGeneration(
        accessToken,
      ).catch(() => null);
    }

    if (
      error instanceof Error &&
      error.message === "UNAUTHENTICATED"
    ) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        { status: 401 },
      );
    }

    if (
      error instanceof
      AiProviderRateLimitError
    ) {
      return NextResponse.json(
        {
          error:
            "AI provider rate limit reached. Try again later.",
        },
        { status: 429 },
      );
    }

    if (
      error instanceof
      AiProviderTemporaryError
    ) {
      return NextResponse.json(
        {
          error:
            "AI provider is temporarily unavailable.",
        },
        { status: 503 },
      );
    }

    if (
      error instanceof
      AiProviderUnavailableError
    ) {
      return NextResponse.json(
        {
          error:
            "AI generation is currently unavailable.",
        },
        { status: 503 },
      );
    }

    console.error(
      "ShareLite AI message generation failed:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to generate AI email.",
      },
      { status: 500 },
    );
  }
}