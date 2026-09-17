import type { EmailValidationStatus } from "@/lib/supabase-db";

export type EmailValidationResult = {
  status: EmailValidationStatus;
  reason: string;
  normalizedEmail: string;
  providerVerified: false;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const disposableDomains = new Set([
  "mailinator.com",
  "10minutemail.com",
  "guerrillamail.com",
  "tempmail.com",
]);

export function validateEmailSyntax(
  value: string
): EmailValidationResult {
  const normalizedEmail = value.trim().toLowerCase();

  if (normalizedEmail.length > 320) {
    return {
      status: "invalid",
      reason: "Email exceeds the maximum length.",
      normalizedEmail,
      providerVerified: false,
    };
  }

  if (!emailPattern.test(normalizedEmail)) {
    return {
      status: "invalid",
      reason: "Email syntax is invalid.",
      normalizedEmail,
      providerVerified: false,
    };
  }

  const domain = normalizedEmail.split("@")[1];

  if (disposableDomains.has(domain)) {
    return {
      status: "disposable",
      reason: "Disposable email domain detected.",
      normalizedEmail,
      providerVerified: false,
    };
  }

  return {
    status: "valid",
    reason: "Email syntax is valid.",
    normalizedEmail,
    providerVerified: false,
  };
}