import { createHash } from "node:crypto";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;
const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(request: Request) {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-forwarded-for") ||
    "unknown";
  const client = forwarded.split(",")[0].trim();
  const key = createHash("sha256").update(client).digest("hex").slice(0, 32);
  const now = Date.now();
  const current = buckets.get(key);
  const bucket =
    !current || current.resetAt <= now
      ? { count: 0, resetAt: now + WINDOW_MS }
      : current;
  bucket.count += 1;
  buckets.set(key, bucket);

  if (buckets.size > 1_000) {
    for (const [candidate, value] of buckets) {
      if (value.resetAt <= now) buckets.delete(candidate);
    }
  }

  return {
    allowed: bucket.count <= MAX_REQUESTS,
    limit: MAX_REQUESTS,
    remaining: Math.max(0, MAX_REQUESTS - bucket.count),
    resetSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
  };
}
