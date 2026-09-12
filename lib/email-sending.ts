export type EmailSendInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type EmailSendResult = { provider: string; providerMessageId: string };

export class EmailProviderUnavailableError extends Error {
  constructor() { super("EMAIL_PROVIDER_NOT_CONFIGURED"); }
}

export class EmailProviderRateLimitError extends Error {
  constructor() { super("EMAIL_PROVIDER_RATE_LIMITED"); }
}

export class EmailProviderTemporaryError extends Error {
  constructor() { super("EMAIL_PROVIDER_TEMPORARY_FAILURE"); }
}

function providerConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  return apiKey && from ? { apiKey, from } : null;
}

/** Legitimate server-side provider boundary. It never returns success without provider acceptance. */
export async function sendEmail(input: EmailSendInput): Promise<EmailSendResult> {
  const config = providerConfig();
  if (!config) throw new EmailProviderUnavailableError();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: config.from, to: [input.to], subject: input.subject, text: input.text, ...(input.html ? { html: input.html } : {}) }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (response.status === 429) throw new EmailProviderRateLimitError();
    if (!response.ok) throw new EmailProviderTemporaryError();
    const payload = await response.json().catch(() => null) as { id?: string } | null;
    if (!payload?.id) throw new EmailProviderTemporaryError();
    return { provider: "resend", providerMessageId: payload.id };
  } catch (error) {
    if (error instanceof EmailProviderRateLimitError || error instanceof EmailProviderTemporaryError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new EmailProviderTemporaryError();
    throw new EmailProviderTemporaryError();
  } finally {
    clearTimeout(timeout);
  }
}

export function isEmailProviderConfigured() {
  return providerConfig() !== null;
}
