import crypto from "crypto";

const IV_LENGTH = 12;
const STATE_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error(
      "CRITICAL ERROR: TOKEN_ENCRYPTION_KEY environment variable is missing."
    );
  }

  const keyBuffer = Buffer.from(encryptionKey, "hex");

  if (keyBuffer.length !== 32) {
    throw new Error(
      "CRITICAL ERROR: TOKEN_ENCRYPTION_KEY must be a valid 32-byte hex string (64 hexadecimal characters)."
    );
  }

  return keyBuffer;
}

export function encrypt(text: string): string {
  const keyBuffer = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    keyBuffer,
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(text, "utf8")),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

export function decrypt(value: string): string {
  const keyBuffer = getEncryptionKey();

  const parts = value.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format.");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");

  if (iv.length !== IV_LENGTH) {
    throw new Error("Invalid encryption IV.");
  }

  if (authTag.length !== 16) {
    throw new Error("Invalid encryption authentication tag.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    keyBuffer,
    iv
  );

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Generates a cryptographically secure OAuth state value.
 */
export function generateOAuthState(): string {
  return crypto.randomBytes(STATE_LENGTH).toString("hex");
}

/**
 * Constant-time comparison for OAuth state validation.
 */
export function validateOAuthState(
  receivedState: string | null | undefined,
  storedState: string | null | undefined
): boolean {
  if (!receivedState || !storedState) {
    return false;
  }

  const received = Buffer.from(receivedState, "utf8");
  const stored = Buffer.from(storedState, "utf8");

  if (received.length !== stored.length) {
    return false;
  }

  return crypto.timingSafeEqual(received, stored);
}

/**
 * Builds the Google OAuth authorization URL.
 */
export function buildGoogleOAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is missing.");
  }

  if (!redirectUri) {
    throw new Error("GOOGLE_REDIRECT_URI is missing.");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
    ].join(" "),
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google OAuth configuration is incomplete. Required: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI."
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}