type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfter: number;
};

const limits = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60_000;
const MAX_ENTRIES = 10_000;

function now() {
  return Date.now();
}

function pruneExpired(currentTime: number) {
  if (limits.size < MAX_ENTRIES) return;
  for (const [key, entry] of limits) {
    if (entry.resetAt <= currentTime) limits.delete(key);
    if (limits.size < MAX_ENTRIES) break;
  }
}

function trustedProxyAddress(request: Request) {
  // Forwarded headers are client-spoofable unless the deployment proxy is
  // configured to overwrite them. Keep them disabled by default.
  if (process.env.TRUSTED_PROXY_HEADERS !== "true") return null;
  return request.headers.get("x-real-ip")?.trim()
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? null;
}

export function getClientKey(request: Request, scope: string, identity?: string) {
  return `${scope}:${identity ?? trustedProxyAddress(request) ?? "unknown"}`;
}

export function checkRateLimit(key: string, maxRequests: number, windowMs = WINDOW_MS): RateLimitResult {
  const currentTime = now();
  pruneExpired(currentTime);
  const existing = limits.get(key);

  if (!existing || existing.resetAt <= currentTime) {
    limits.set(key, { count: 1, resetAt: currentTime + windowMs });
    return { allowed: true, retryAfter: Math.ceil(windowMs / 1000) };
  }

  if (existing.count >= maxRequests) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((existing.resetAt - currentTime) / 1000)) };
  }

  existing.count += 1;
  return { allowed: true, retryAfter: Math.max(1, Math.ceil((existing.resetAt - currentTime) / 1000)) };
}

export function rateLimitResponse(result: RateLimitResult) {
  return new Response(JSON.stringify({ error: "Too many requests. Try again later." }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(result.retryAfter),
      "Cache-Control": "no-store",
    },
  });
}
