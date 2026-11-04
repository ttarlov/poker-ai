import { ROOM_CODE_PATTERN } from "../../shared/room-protocol";
import { Room, type Env } from "./room";

export { Room };

// Routes:
//   GET /rooms/:code          WebSocket upgrade into that room's Durable Object
//   GET /rooms/:code/exists   { exists, name?, code? } (CORS-enabled)
//   GET /health               liveness check
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
    const originOk = !origin || allowed.includes(origin);
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
