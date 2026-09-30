import { promises as dns } from "node:dns";
import type { EmailValidationStatus } from "@/lib/supabase-db";

export type EmailValidationResult = {
  status: EmailValidationStatus;
  reason: string;
  normalizedEmail: string;
  providerVerified: false;
  domainVerified: boolean;
};

const EMAIL_MAX_LENGTH = 320;
const LOCAL_PART_MAX_LENGTH = 64;
const DOMAIN_MAX_LENGTH = 253;

const emailPattern =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;

const disposableDomains = new Set([
  "10minutemail.com",
  "10minutemail.net",
  "20minutemail.com",
  "emailondeck.com",
  "fakeinbox.com",
  "getnada.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamailblock.com",
  "maildrop.cc",
  "mailinator.com",
  "mailnesia.com",
  "mohmal.com",
  "sharklasers.com",
  "temp-mail.org",
  "tempmail.com",
  "throwawaymail.com",
  "yopmail.com",
]);

function makeResult(
  status: EmailValidationStatus,
  email: string,
  reason: string,
  domainVerified = false,
): EmailValidationResult {
  return {
    status,
    reason,
    normalizedEmail: email,
    providerVerified: false,
    domainVerified,
  };
}

function splitEmail(email: string) {
  const atIndex = email.lastIndexOf("@");

  if (atIndex <= 0 || atIndex === email.length - 1) {
    return null;
  }

  return {
    localPart: email.slice(0, atIndex),
    domain: email.slice(atIndex + 1),
  };
}

function invalidLocalPart(localPart: string): boolean {
  return (
    localPart.length === 0 ||
    localPart.length > LOCAL_PART_MAX_LENGTH ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..")
  );
}

function invalidDomain(domain: string): boolean {
  if (
    domain.length === 0 ||
    domain.length > DOMAIN_MAX_LENGTH ||
    domain.startsWith(".") ||
    domain.endsWith(".") ||
    domain.includes("..")
  ) {
    return true;
  }

  const labels = domain.split(".");

  if (labels.length < 2) {
    return true;
  }

  return labels.some(
    (label) =>
      label.length === 0 ||
      label.length > 63 ||
      label.startsWith("-") ||
      label.endsWith("-"),
  );
}

async function checkMailDomain(domain: string) {
  const [mxResult, ipv4Result, ipv6Result] =
    await Promise.allSettled([
      dns.resolveMx(domain),
      dns.resolve4(domain),
      dns.resolve6(domain),
    ]);

  let hasMx = false;
  let nullMx = false;

  if (mxResult.status === "fulfilled") {
    const records = mxResult.value;

    nullMx = records.some((record) => record.exchange === ".");

    hasMx =
      records.length > 0 &&
      records.some((record) => record.exchange !== ".");
  }

  const hasAddress =
    (ipv4Result.status === "fulfilled" &&
      ipv4Result.value.length > 0) ||
    (ipv6Result.status === "fulfilled" &&
      ipv6Result.value.length > 0);

  return {
    hasMx,
    hasAddress,
    nullMx,
  };
}

export async function validateEmailAddress(
  value: string,
): Promise<EmailValidationResult> {
  const normalizedEmail = value.trim().toLowerCase();

  // 1. Empty
  if (!normalizedEmail) {
    return makeResult(
      "invalid",
      normalizedEmail,
      "Email address is required.",
    );
  }

  // 2. Maximum length
  if (normalizedEmail.length > EMAIL_MAX_LENGTH) {
    return makeResult(
      "invalid",
      normalizedEmail,
      "Email address is too long.",
    );
  }

  // 3. Basic email syntax
  if (!emailPattern.test(normalizedEmail)) {
    return makeResult(
      "invalid",
      normalizedEmail,
      "Email address format is invalid or incomplete.",
    );
  }

  const parts = splitEmail(normalizedEmail);

  // 4. Must contain a complete local@domain structure
  if (!parts) {
    return makeResult(
      "invalid",
      normalizedEmail,
      "Email address format is invalid or incomplete.",
    );
  }

  const { localPart, domain } = parts;

  // 5. Local part validation
  if (invalidLocalPart(localPart)) {
    return makeResult(
      "invalid",
      normalizedEmail,
      "The mailbox name is invalid.",
    );
  }

  // 6. Domain validation
  if (invalidDomain(domain)) {
    return makeResult(
      "invalid",
      normalizedEmail,
      "The email domain is invalid or incomplete.",
    );
  }

  // 7. Disposable email protection
  if (disposableDomains.has(domain)) {
    return makeResult(
      "risky",
      normalizedEmail,
      "Disposable email addresses are not supported.",
      false,
    );
  }

  // 8. DNS / mail-server verification
  try {
    const mailDomain = await checkMailDomain(domain);

    // Domain explicitly rejects email
    if (mailDomain.nullMx && !mailDomain.hasMx) {
      return makeResult(
        "invalid",
        normalizedEmail,
        "This domain explicitly does not accept email.",
        false,
      );
    }

    // No MX and no usable address
    if (!mailDomain.hasMx && !mailDomain.hasAddress) {
      return makeResult(
        "invalid",
        normalizedEmail,
        "This domain does not appear to have a working mail destination.",
        false,
      );
    }

    // Valid receiving domain.
    // We intentionally do NOT mark names like hello/info/admin as risky.
    return {
      status: "valid",
      reason:
        "Email format and receiving mail domain are verified. Exact mailbox existence has not been independently confirmed.",
      normalizedEmail,
      providerVerified: false,
      domainVerified: true,
    };
  } catch {
    return makeResult(
      "unknown",
      normalizedEmail,
      "The email domain could not be verified right now. Please try again later.",
      false,
    );
  }
}