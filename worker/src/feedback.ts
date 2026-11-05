import type { Env } from "./room";

// POST /feedback — the "Suggest a feature" form. The browser posts here; the Worker
// screens the request and forwards it to the owner's inbox (tarastarlov.com Comms)
// with a shared token the browser never sees. Delivery is best-effort per message:
// the inbox applies its own per-visitor and daily caps.

const KINDS = new Set(["feature", "change", "bug"]);
const MIN_FILL_MS = 3000;
const MAX_BODY = 8 * 1024;
const LIMITS = { message: 2000, email: 200 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function handleFeedback(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const reply = (status: number, body: object) => Response.json(body, { status, headers: cors });

  if (request.method !== "POST") return reply(405, { error: "Method not allowed" });
  // Browsers always send Origin on this cross-origin POST; the caller already checked it is allowed.
  if (!request.headers.get("Origin")) return reply(403, { error: "Forbidden" });

  const raw = await request.text();
  if (raw.length > MAX_BODY) return reply(413, { error: "That's too long." });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return reply(400, { error: "Bad request" });
  }
  if (!body || typeof body !== "object") return reply(400, { error: "Bad request" });

  // Bots fill the hidden field and submit instantly. Answer like a success.
  if (body.website) return reply(200, { ok: true });
  const startedAt = Number(body.t) || 0;
  if (!startedAt || Date.now() - startedAt < MIN_FILL_MS) return reply(200, { ok: true });

  const message = str(body.message, LIMITS.message).trim();
  const email = str(body.email, LIMITS.email).trim();
  const kind = KINDS.has(str(body.kind, 10)) ? str(body.kind, 10) : "feature";
  if (!message) return reply(400, { error: "Write a suggestion first." });
  if (email && !EMAIL_RE.test(email)) return reply(400, { error: "That email address looks off." });

  if (!env.SUGGEST_URL || !env.SUGGEST_TOKEN) return reply(503, { error: "Suggestions are offline right now." });

  // Count only suggestions that would be delivered, so a typo retry isn't penalized.
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (env.FEEDBACK_LIMITER) {
    const { success } = await env.FEEDBACK_LIMITER.limit({ key: ip });
    if (!success) return reply(429, { error: "Too many suggestions. Try again in a minute." });
  }

  let res: Response;
  try {
    res = await fetch(env.SUGGEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-suggest-token": env.SUGGEST_TOKEN },
      body: JSON.stringify({ kind, email, message, ipHash: await hashIp(ip) }),
    });
  } catch {
    return reply(502, { error: "Couldn't send right now. Try again shortly." });
  }
  if (res.ok) return reply(200, { ok: true });

  // Pass the inbox's own user-facing errors (rate limits, validation) through.
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 400 || res.status === 429) {
    return reply(res.status, { error: str(data.error, 200) || "Couldn't send that." });
  }
  return reply(502, { error: "Couldn't send right now. Try again shortly." });
}

async function hashIp(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("agilepoker-feedback:" + ip));
  return [...new Uint8Array(digest)].slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");
}

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}
