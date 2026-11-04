import { generateRoomCode, LIMITS } from "../../shared/room-protocol";
import type { Env, SeedTicket } from "./room";

// Slack integration, level 1: the /poker slash command creates a room and posts a
// join link in the channel. No Slack tokens are stored; the command reply goes back
// in the HTTP response body, so the only secret needed per request is the signing secret.
//
// Routes:
//   POST /slack/commands       slash command (signed by Slack)
//   POST /slack/interactions   acks the link button click (signed by Slack)
//   GET  /slack/install        starts "Add to Slack" (sets a state cookie, redirects to Slack)
//   GET  /slack/oauth          OAuth redirect target; finishes the install

const MAX_BODY = 8 * 1024;
const MAX_SKEW_SEC = 5 * 60;
const STATE_COOKIE = "agilepoker_slack_state";
const enc = new TextEncoder();

export async function handleSlack(request: Request, env: Env, url: URL): Promise<Response> {
  switch (url.pathname) {
    case "/slack/install":
      return install(env);
    case "/slack/oauth":
      return oauthCallback(request, env, url);
    case "/slack/commands":
    case "/slack/interactions":
      break;
    default:
      return new Response("Not found", { status: 404 });
  }

  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const body = await request.text();
  if (body.length > MAX_BODY) return new Response("Too large", { status: 413 });
  if (!(await verifySignature(request, body, env.SLACK_SIGNING_SECRET))) {
    return new Response("Bad signature", { status: 401 });
  }

  // The "Join and vote" button is a link; Slack still posts the click here and wants a 200.
  if (url.pathname === "/slack/interactions") return new Response(null, { status: 200 });

  const form = new URLSearchParams(body);
  if (form.get("ssl_check")) return new Response(null, { status: 200 });

  const text = unescapeSlack(form.get("text") ?? "").trim();
  if (/^(help|\?)$/i.test(text)) return ephemeral(USAGE);

  const ticket = parseTicket(text);
  const roomName = roomNameFor(form.get("channel_name"));
  const appUrl = (env.APP_URL || "https://agilepoker.dev").replace(/\/+$/, "");

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateRoomCode();
    const stub = env.ROOM.get(env.ROOM.idFromName(code));
    if (await stub.createSeeded(code, roomName, ticket)) {
      return Response.json(roomMessage(`${appUrl}/session/${code}`, code, ticket, form.get("user_id")));
    }
  }
  return ephemeral("Couldn't create a room just now. Try `/poker` again.");
}

// ── command text ──────────────────────────────────────────────────────

const USAGE = [
  "*AgilePoker* starts a planning poker room and posts the link here.",
  "• `/poker` opens an empty room",
  "• `/poker PROJ-123 Login times out` opens a room with that ticket ready to vote",
  "• `/poker https://acme.atlassian.net/browse/PROJ-123` links the ticket",
  "Votes stay hidden until someone reveals them. Rooms expire after 24 hours of inactivity.",
].join("\n");

const JIRA_KEY = /^([A-Z][A-Z0-9_]+-\d+)(?=$|[\s:.,])[\s:.,\-–—]*/;

export function parseTicket(text: string): SeedTicket | null {
  let rest = text.trim();
  if (!rest) return null;

  let externalUrl: string | undefined;
  let jiraKey: string | undefined;

  // Slack sends links as <https://x|label> or <https://x> when link escaping is on, bare otherwise.
  const link = rest.match(/<(https?:\/\/[^|>\s]+)(?:\|[^>]*)?>|(https?:\/\/[^\s<>|]+)/);
  if (link && link.index !== undefined) {
    externalUrl = (link[1] ?? link[2]).slice(0, LIMITS.url);
    rest = (rest.slice(0, link.index) + " " + rest.slice(link.index + link[0].length)).replace(/\s+/g, " ").trim();
    const fromUrl = externalUrl.match(/\/browse\/([A-Z][A-Z0-9_]+-\d+)/);
    if (fromUrl) jiraKey = fromUrl[1];
  }

  const key = rest.match(JIRA_KEY);
  if (key) {
    jiraKey ??= key[1];
    rest = rest.slice(key[0].length).trim();
  }

  const title = (rest || jiraKey || externalUrl || "").slice(0, LIMITS.title);
  if (!title) return null;
  return {
    title,
    ...(jiraKey ? { jiraKey: jiraKey.slice(0, LIMITS.jiraKey) } : {}),
    ...(externalUrl ? { externalUrl } : {}),
  };
}

function roomNameFor(channel: string | null): string {
  if (!channel || channel === "directmessage" || channel === "privategroup") return "Slack planning session";
  return `#${channel} planning`.slice(0, LIMITS.roomName);
}

// Slack encodes &, < and > in command text.
function unescapeSlack(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function escapeMrkdwn(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── replies ───────────────────────────────────────────────────────────

function ephemeral(text: string): Response {
  return Response.json({ response_type: "ephemeral", text });
}

function roomMessage(link: string, code: string, ticket: SeedTicket | null, userId: string | null) {
  const label = ticket
    ? escapeMrkdwn(ticket.jiraKey && ticket.title !== ticket.jiraKey ? `${ticket.jiraKey} ${ticket.title}` : ticket.title)
    : null;
  const ticketText = label && ticket?.externalUrl ? `<${ticket.externalUrl}|${label}>` : label;
  const headline = ticketText ? `*Planning poker:* ${ticketText}` : "*Planning poker room is open.*";
  const by = userId && /^[UW][A-Z0-9]+$/.test(userId) ? ` · started by <@${userId}>` : "";

  return {
    response_type: "in_channel",
    text: `${ticket ? `Planning poker: ${ticket.title}` : "Planning poker room"} ${link}`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: headline } },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            action_id: "join_room",
            style: "primary",
            text: { type: "plain_text", text: "Join and vote" },
            url: link,
          },
        ],
      },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: `Room \`${code}\`${by} · votes stay hidden until reveal` }],
      },
    ],
  };
}

// ── request signing ───────────────────────────────────────────────────
// https://api.slack.com/authentication/verifying-requests-from-slack

export async function verifySignature(request: Request, body: string, secret: string | undefined): Promise<boolean> {
  if (!secret) return false;
  const ts = request.headers.get("X-Slack-Request-Timestamp") ?? "";
  const sig = request.headers.get("X-Slack-Signature") ?? "";
  if (!/^\d{1,12}$/.test(ts) || !sig.startsWith("v0=")) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > MAX_SKEW_SEC) return false;

  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`v0:${ts}:${body}`)));
  const expected = enc.encode("v0=" + [...mac].map(b => b.toString(16).padStart(2, "0")).join(""));
  const given = enc.encode(sig);
  return expected.byteLength === given.byteLength && crypto.subtle.timingSafeEqual(expected, given);
}

// ── Add to Slack ──────────────────────────────────────────────────────

function install(env: Env): Response {
  if (!env.SLACK_CLIENT_ID) return new Response("Slack install is not configured", { status: 503 });
  const state = crypto.randomUUID();
  const authorize = new URL("https://slack.com/oauth/v2/authorize");
  authorize.searchParams.set("client_id", env.SLACK_CLIENT_ID);
  authorize.searchParams.set("scope", "commands");
  authorize.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      "Set-Cookie": `${STATE_COOKIE}=${state}; Path=/slack; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
      "Cache-Control": "no-store",
    },
  });
}

async function oauthCallback(request: Request, env: Env, url: URL): Promise<Response> {
  const clear = `${STATE_COOKIE}=; Path=/slack; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
  if (url.searchParams.get("error")) return page("Install cancelled", "Nothing was added to your Slack workspace.", clear, 200);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = (request.headers.get("Cookie") ?? "")
    .split(";")
    .map(c => c.trim())
    .find(c => c.startsWith(`${STATE_COOKIE}=`))
    ?.slice(STATE_COOKIE.length + 1);
  if (!code || !state || !cookie || cookie !== state) {
    return page("Install link expired", "Start again from the Add to Slack button.", clear, 400);
  }
  if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) {
    return page("Slack install is not configured", "Try again later.", clear, 503);
  }

  // Exchanging the code is what completes the install. The returned bot token is not
  // kept: the slash command answers in its HTTP response and never calls Slack's API.
  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + btoa(`${env.SLACK_CLIENT_ID}:${env.SLACK_CLIENT_SECRET}`),
    },
    body: new URLSearchParams({ code }),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; team?: { name?: string } };
  if (!data.ok) return page("Install failed", "Slack didn't accept the install. Start again from the Add to Slack button.", clear, 502);

  const team = data.team?.name ? ` to ${data.team.name}` : "";
  return page("AgilePoker is installed", `AgilePoker was added${team}. Type /poker in any channel to start a room.`, clear, 200);
}

function page(title: string, message: string, setCookie: string, status: number): Response {
  const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.5 system-ui,sans-serif;background:#0f1115;color:#e8e8ea}main{max-width:28rem;padding:2rem 1rem;text-align:center}h1{font-size:1.4rem;margin:0 0 .5rem}a{color:#7cc4ff}</style></head>
<body><main><h1>${esc(title)}</h1><p>${esc(message)}</p><p><a href="https://agilepoker.dev">agilepoker.dev</a></p></main></body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Set-Cookie": setCookie, "Cache-Control": "no-store" },
  });
}
