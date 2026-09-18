import { NextResponse } from "next/server";
import { getLead, requireAuthenticatedUser } from "@/lib/supabase-db";
import { checkRateLimit, getClientKey, rateLimitResponse } from "@/lib/rate-limit";
import {
  consumeAiGeneration,
  releaseAiGeneration,
} from "@/lib/monetization";
import { generatePersonalizedMessage, AiProviderUnavailableError, AiProviderRateLimitError, AiProviderTemporaryError, isAiProviderConfigured, type PersonalizationInput } from "@/lib/ai-personalization";

type Context = { params: Promise<{ id: string }> };
function parseInput(value: unknown): PersonalizationInput | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body.goal !== "string" || !body.goal.trim() || body.goal.trim().length > 500) return null;
  if (body.tone !== "professional" && body.tone !== "friendly" && body.tone !== "concise") return null;
  if (body.instructions !== undefined && (typeof body.instructions !== "string" || body.instructions.length > 1000)) return null;
  return { goal: body.goal.trim(), tone: body.tone, instructions: typeof body.instructions === "string" ? body.instructions.trim() : undefined };
}
export async function POST(request: Request, context: Context) {
  const rateLimit = checkRateLimit(getClientKey(request, "ai-message"), 20);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
  try {
    const input = parseInput(await request.json().catch(() => null));
    if (!input) return NextResponse.json({ error: "A valid goal and tone are required." }, { status: 400 });
    const { accessToken } = await requireAuthenticatedUser();
    const { id } = await context.params;
    const lead = await getLead(accessToken, id);
    if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    if (!isAiProviderConfigured()) return NextResponse.json({ error: "AI personalization is not configured." }, { status: 503 });
     const consumed = await consumeAiGeneration(accessToken);

if (!consumed) {
  return NextResponse.json(
    {
      error:
        "AI generation limit reached for your plan or ShareLite AI budget.",
    },
    { status: 403 },
  );
}

try {
  const generated = await generatePersonalizedMessage(
    lead,
    input,
  );

  return NextResponse.json({
    message: generated.message,
    provider: generated.provider,
  });
} catch (error) {
  try {
    await releaseAiGeneration(accessToken);
  } catch (releaseError) {
    console.error(
      "[AI Generation Refund Failed]",
      releaseError,
    );
  }

  throw error;
}
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof AiProviderUnavailableError) return NextResponse.json({ error: "AI personalization is not configured." }, { status: 503 });
    if (error instanceof AiProviderRateLimitError) return NextResponse.json({ error: "AI provider rate limit reached. Try again later." }, { status: 429 });
    if (error instanceof AiProviderTemporaryError) return NextResponse.json({ error: "AI provider is temporarily unavailable." }, { status: 503 });
    return NextResponse.json({ error: "Unable to generate a personalized message." }, { status: 500 });
  }
}
