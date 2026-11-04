import { ROOM_CODE_PATTERN } from "../../shared/room-protocol";
import { Room, type Env } from "./room";
import { handleSlack } from "./slack";

export { Room };

// Routes:
//   GET /rooms/:code          WebSocket upgrade into that room's Durable Object
//   GET /rooms/:code/exists   { exists, name?, code? } (CORS-enabled)
//   GET /health               liveness check
//   /slack/*                  Slack slash command + install (see slack.ts)
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Slack calls are server-to-server and signed; they skip the browser origin checks.
    if (url.pathname.startsWith("/slack/")) return handleSlack(request, env, url);

    const origin = request.headers.get("Origin");
    const originOk = !origin || originAllowed(origin, env.ALLOWED_ORIGINS);
    const cors: Record<string, string> = origin && originOk
      ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" }
      : {};

    if (request.method === "OPTIONS") {
      return new Response(null, { status: originOk ? 204 : 403, headers: { ...cors, "Access-Control-Allow-Methods": "GET" } });
    }

    if (url.pathname === "/health") return new Response("ok", { headers: cors });

    const match = url.pathname.match(/^\/rooms\/([^/]+)(\/exists)?$/);
    if (!match || request.method !== "GET") return new Response("Not found", { status: 404, headers: cors });
    if (!originOk) return new Response("Origin not allowed", { status: 403 });

    // Per-IP cap on new connections and room lookups. Messages inside an open
    // socket are throttled by the room itself.
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (env.CONNECT_LIMITER) {
      const { success } = await env.CONNECT_LIMITER.limit({ key: ip });
      if (!success) return new Response("Too many requests", { status: 429, headers: cors });
    }

    const code = decodeURIComponent(match[1]).toUpperCase();
    if (!ROOM_CODE_PATTERN.test(code)) return new Response("Bad room code", { status: 400, headers: cors });

    const stub = env.ROOM.get(env.ROOM.idFromName(code));
    const forwarded = new Request(request.url, request);
    forwarded.headers.set("X-Room-Code", code);
    const res = await stub.fetch(forwarded);

    if (match[2]) {
      // Re-wrap so CORS headers can be added to the JSON response.
      const body = await res.text();
      return new Response(body, { status: res.status, headers: { "Content-Type": "application/json", ...cors } });
    }
    return res;
  },
} satisfies ExportedHandler<Env>;

// ALLOWED_ORIGINS is a comma-separated list; an entry may contain "*" to match
// one hostname segment, e.g. https://poker-*-ttarlovs-projects.vercel.app
function originAllowed(origin: string, list: string): boolean {
  for (const raw of (list || "").split(",")) {
    const entry = raw.trim();
    if (!entry) continue;
    if (!entry.includes("*")) {
      if (entry === origin) return true;
      continue;
    }
    const pattern = new RegExp("^" + entry.split("*").map(escapeRegExp).join("[a-z0-9-]+") + "$");
    if (pattern.test(origin)) return true;
  }
  return false;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
