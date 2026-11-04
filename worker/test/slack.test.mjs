// End-to-end test of the Slack routes against `wrangler dev` (default http://localhost:8787).
// Needs worker/.dev.vars with SLACK_SIGNING_SECRET=local-test-secret (and SLACK_CLIENT_ID=anything).
// Run: npm run dev  (in one shell), then  npm run test:slack
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

const BASE = process.env.ROOMS_URL || "http://localhost:8787";
const SECRET = process.env.SLACK_SIGNING_SECRET || "local-test-secret";
const ORIGIN = "http://localhost:3000";

let passed = 0;
const step = name => { passed++; console.log(`  ✓ ${name}`); };

function sign(body, ts = Math.floor(Date.now() / 1000), secret = SECRET) {
  const sig = "v0=" + createHmac("sha256", secret).update(`v0:${ts}:${body}`).digest("hex");
  return { "X-Slack-Request-Timestamp": String(ts), "X-Slack-Signature": sig };
}

function form(fields) {
  return new URLSearchParams({
    token: "ignored", team_id: "T0001", channel_id: "C0001", channel_name: "sprint-team",
    user_id: "U0001", user_name: "taras", command: "/poker", text: "",
    response_url: "https://hooks.slack.com/commands/x", trigger_id: "1.2.3", ...fields,
  }).toString();
}

async function command(text, opts = {}) {
  const body = form({ text, ...(opts.fields || {}) });
  const headers = { "Content-Type": "application/x-www-form-urlencoded", ...(opts.headers ?? sign(body)) };
  return fetch(`${BASE}/slack/commands`, { method: "POST", headers, body });
}

const codeFrom = msg => msg.blocks[1].elements[0].url.match(/\/session\/([A-Z0-9-]+)$/)[1];

function joinRoom(code) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${BASE.replace(/^http/, "ws")}/rooms/${code}`, { headers: { Origin: ORIGIN } });
    const timer = setTimeout(() => reject(new Error("timeout joining " + code)), 3000);
    ws.onopen = () => ws.send(JSON.stringify({ t: "join", pid: "web-1", name: "Web" }));
    ws.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      clearTimeout(timer); ws.close();
      msg.t === "state" ? resolve(msg.state) : reject(new Error(JSON.stringify(msg)));
    };
    ws.onerror = reject;
  });
}

// 1. Signature checks
let r = await command("PROJ-1 x", { headers: {} });
assert.equal(r.status, 401); step("unsigned request -> 401");
r = await command("PROJ-1 x", { headers: sign(form({ text: "PROJ-1 x" }), Math.floor(Date.now() / 1000), "wrong-secret") });
assert.equal(r.status, 401); step("wrong signing secret -> 401");
r = await command("PROJ-1 x", { headers: sign(form({ text: "PROJ-1 x" }), Math.floor(Date.now() / 1000) - 600) });
assert.equal(r.status, 401); step("timestamp 10 minutes old -> 401 (replay guard)");
const tampered = sign(form({ text: "PROJ-1 x" }));
r = await command("PROJ-1 y", { headers: tampered });
assert.equal(r.status, 401); step("body changed after signing -> 401");
r = await fetch(`${BASE}/slack/commands`);
assert.equal(r.status, 405); step("GET /slack/commands -> 405");

// 2. Help
r = await command("help");
let msg = await r.json();
assert.equal(msg.response_type, "ephemeral"); assert.match(msg.text, /\/poker PROJ-123/); step("/poker help -> private usage text");

// 3. Key + title: room created, ticket open for voting, link posted to the channel
r = await command("PROJ-123 Login times out on Safari");
assert.equal(r.status, 200);
msg = await r.json();
assert.equal(msg.response_type, "in_channel");
assert.match(msg.blocks[0].text.text, /PROJ-123 Login times out on Safari/);
assert.match(msg.blocks[2].elements[0].text, /<@U0001>/);
let code = codeFrom(msg);
assert.match(msg.blocks[1].elements[0].url, /^https:\/\/agilepoker\.dev\/session\//);
r = await fetch(`${BASE}/rooms/${code}/exists`, { headers: { Origin: ORIGIN } });
assert.deepEqual(await r.json(), { exists: true, name: "#sprint-team planning", code });
let state = await joinRoom(code);
assert.equal(state.tickets.length, 1);
assert.equal(state.tickets[0].title, "Login times out on Safari");
assert.equal(state.tickets[0].jira_key, "PROJ-123");
assert.equal(state.tickets[0].status, "voting");
assert.equal(state.currentTicketId, state.tickets[0].id);
step("/poker PROJ-123 title -> room exists, ticket open for voting, link in channel");

// 4. Jira URL (Slack-escaped form) -> key taken from the URL, title linked
r = await command("&lt;https://acme.atlassian.net/browse/WEB-42|WEB-42&gt; Checkout button");
msg = await r.json();
code = codeFrom(msg);
assert.match(msg.blocks[0].text.text, /<https:\/\/acme\.atlassian\.net\/browse\/WEB-42\|WEB-42 Checkout button>/);
state = await joinRoom(code);
assert.equal(state.tickets[0].jira_key, "WEB-42");
assert.equal(state.tickets[0].external_url, "https://acme.atlassian.net/browse/WEB-42");
assert.equal(state.tickets[0].title, "Checkout button");
step("Jira link -> key parsed from URL, ticket links back");

// 5. No text -> empty room; DM -> generic room name
r = await command("", { fields: { channel_name: "directmessage" } });
msg = await r.json();
code = codeFrom(msg);
assert.match(msg.blocks[0].text.text, /room is open/);
state = await joinRoom(code);
assert.equal(state.tickets.length, 0);
assert.equal(state.roomName, "Slack planning session");
step("/poker with no text in a DM -> empty room named 'Slack planning session'");

// 6. Markup in the title is escaped in the Slack message
r = await command("<!channel> & <b>bold</b>");
msg = await r.json();
assert.ok(!msg.blocks[0].text.text.includes("<!channel>")); assert.match(msg.blocks[0].text.text, /&lt;!channel&gt; &amp;/);
step("@channel and HTML in the title are escaped, not rendered");

// 7. Interactions endpoint acks signed clicks only
const ibody = "payload=" + encodeURIComponent(JSON.stringify({ type: "block_actions" }));
r = await fetch(`${BASE}/slack/interactions`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", ...sign(ibody) }, body: ibody });
assert.equal(r.status, 200);
r = await fetch(`${BASE}/slack/interactions`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: ibody });
assert.equal(r.status, 401); step("button-click ack: signed -> 200, unsigned -> 401");

// 8. Install flow: state cookie + redirect; callback rejects missing/mismatched state
r = await fetch(`${BASE}/slack/install`, { redirect: "manual" });
assert.equal(r.status, 302);
const loc = new URL(r.headers.get("location"));
assert.equal(loc.origin + loc.pathname, "https://slack.com/oauth/v2/authorize");
assert.equal(loc.searchParams.get("scope"), "commands");
const state0 = loc.searchParams.get("state");
assert.match(r.headers.get("set-cookie"), new RegExp(`agilepoker_slack_state=${state0}; Path=/slack;.*HttpOnly; Secure`));
r = await fetch(`${BASE}/slack/oauth?code=abc&state=${state0}`);
assert.equal(r.status, 400);
r = await fetch(`${BASE}/slack/oauth?code=abc&state=${state0}`, { headers: { Cookie: "agilepoker_slack_state=other" } });
assert.equal(r.status, 400);
r = await fetch(`${BASE}/slack/oauth?error=access_denied`);
assert.equal(r.status, 200); assert.match(await r.text(), /Install cancelled/);
step("install sets state cookie + redirects to Slack; callback rejects bad state, handles cancel");

// 9. Existing web routes unaffected
r = await fetch(`${BASE}/health`);
assert.equal(await r.text(), "ok"); step("/health still ok");

console.log(`\n${passed} checks passed`);
