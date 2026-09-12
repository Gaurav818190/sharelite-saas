import { NextResponse } from "next/server";
import { getLead, requireAuthenticatedUser } from "@/lib/supabase-db";
import { consumeEmailSend } from "@/lib/monetization";
import { EmailProviderRateLimitError, EmailProviderTemporaryError, EmailProviderUnavailableError, isEmailProviderConfigured, sendEmail } from "@/lib/email-sending";

type Context = { params: Promise<{ id: string }> };

type SendInput = {
  subject: string;
  text: string;
  html?: string;
};

function parseInput(value: unknown): SendInput | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const html = body.html === undefined ? undefined : typeof body.html === "string" ? body.html : null;
  if (html === null || subject.length < 1 || subject.length > 200 || text.length < 1 || text.length > 100000) return null;
  if (html !== undefined && (html.length > 200000 || !html.trim())) return null;
  return { subject, text, ...(html !== undefined ? { html } : {}) };
}

export async function POST(request: Request, context: Context) {
  try {
    const input = parseInput(await request.json().catch(() => null));
    if (!input) return NextResponse.json({ error: "A valid recipient, subject, and message are required." }, { status: 400 });

    const { accessToken } = await requireAuthenticatedUser();
    const { id } = await context.params;
    const lead = await getLead(accessToken, id);
    if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) return NextResponse.json({ error: "Lead email is invalid." }, { status: 400 });
    if (!isEmailProviderConfigured()) return NextResponse.json({ error: "Email sending is not configured." }, { status: 503 });

    const consumed = await consumeEmailSend(accessToken);
    if (!consumed) return NextResponse.json({ error: "Email sending limit reached for your plan." }, { status: 403 });

    const result = await sendEmail({ ...input, to: lead.email });
    return NextResponse.json({ provider: result.provider, providerMessageId: result.providerMessageId });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (error instanceof EmailProviderUnavailableError) return NextResponse.json({ error: "Email sending is not configured." }, { status: 503 });
    if (error instanceof EmailProviderRateLimitError) return NextResponse.json({ error: "Email provider rate limit reached. Try again later." }, { status: 429 });
    if (error instanceof EmailProviderTemporaryError) return NextResponse.json({ error: "Email provider is temporarily unavailable." }, { status: 503 });
    return NextResponse.json({ error: "Unable to send email." }, { status: 500 });
  }
}
