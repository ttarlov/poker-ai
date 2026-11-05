// End-to-end test of POST /feedback against `wrangler dev`, with a stand-in inbox.
// Needs worker/.dev.vars: SUGGEST_TOKEN=local-suggest-token and
// SUGGEST_URL=http://127.0.0.1:8799/api/push?suggest=1
// Run: npm run dev  (in one shell), then  npm run test:feedback
import assert from "node:assert/strict";
import { createServer } from "node:http";

const BASE = process.env.ROOMS_URL || "http://localhost:8787";
const ORIGIN = "http://localhost:3000";
let passed = 0;
const step = name => { passed++; console.log(`  ✓ ${name}`); };

// Stand-in for tarastarlov.com/api/push?suggest=1
const received = [];
let inboxReply = { status: 200, body: { ok: true } };
const inbox = createServer((req, res) => {
  let data = "";
  req.on("data", c => (data += c));
  req.on("end", () => {
    received.push({ url: req.url, token: req.headers["x-suggest-token"], body: JSON.parse(data || "{}") });
    res.writeHead(inboxReply.status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(inboxReply.body));
  });
});
await new Promise(r => inbox.listen(8799, "127.0.0.1", r));

const ago = ms => Date.now() - ms;
const post = (body, headers = { Origin: ORIGIN }) =>
  fetch(`${BASE}/feedback`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

try {
  // 1. CORS preflight allows POST from the app origin only
  let r = await fetch(`${BASE}/feedback`, { method: "OPTIONS", headers: { Origin: ORIGIN, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" } });
  assert.equal(r.status, 204);
  assert.match(r.headers.get("access-control-allow-methods"), /POST/);
  assert.equal(r.headers.get("access-control-allow-origin"), ORIGIN);
  r = await fetch(`${BASE}/feedback`, { method: "OPTIONS", headers: { Origin: "https://evil.example" } });
  assert.equal(r.status, 403);
  step("preflight: app origin allowed, foreign origin 403");

  // 2. Origin rules
  r = await post({ message: "hi", t: ago(5000) }, {});
  assert.equal(r.status, 403);
  r = await post({ message: "hi", t: ago(5000) }, { Origin: "https://evil.example" });
  assert.equal(r.status, 403);
  r = await fetch(`${BASE}/feedback`, { headers: { Origin: ORIGIN } });
  assert.equal(r.status, 405);
  assert.equal(received.length, 0);
  step("no Origin / foreign Origin -> 403, GET -> 405, nothing forwarded");

  // 3. Bot screens answer 200 but forward nothing
  r = await post({ message: "spam", website: "http://x", t: ago(5000) });
  assert.equal(r.status, 200);
  r = await post({ message: "too fast", t: ago(500) });
  assert.equal(r.status, 200);
  assert.equal(received.length, 0);
  step("honeypot filled / submitted under 3s -> fake 200, nothing forwarded");

  // 4. Validation
  r = await post({ message: "   ", t: ago(5000) });
  assert.equal(r.status, 400);
  r = await post({ message: "x", email: "nope", t: ago(5000) });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /email/);
  step("empty message / bad email -> 400 with a readable error");

  // 5. Happy path: forwarded with token, hashed IP, clamped message, normalized kind
  r = await post({ kind: "bug", message: "Cards overlap on iPhone", email: "dev@example.com", t: ago(5000) });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
  assert.equal(received.length, 1);
  const fwd = received[0];
  assert.equal(fwd.url, "/api/push?suggest=1");
  assert.equal(fwd.token, "local-suggest-token");
  assert.equal(fwd.body.kind, "bug");
  assert.equal(fwd.body.email, "dev@example.com");
  assert.equal(fwd.body.message, "Cards overlap on iPhone");
  assert.match(fwd.body.ipHash, /^[a-f0-9]{16}$/);
  assert.equal(r.headers.get("access-control-allow-origin"), ORIGIN);
  step("valid suggestion forwarded with token + 16-hex IP hash, CORS header on reply");

  // 6. Inbox errors: 429 passes its message through, 500 becomes a generic 502
  inboxReply = { status: 429, body: { error: "The suggestion box is full for today." } };
  r = await post({ kind: "weird", message: "Second idea", t: ago(5000) });
  assert.equal(r.status, 429);
  assert.match((await r.json()).error, /full for today/);
  assert.equal(received.at(-1).body.kind, "feature");
  inboxReply = { status: 500, body: { error: "stack trace with secrets" } };
  r = await post({ message: "Third idea", t: ago(5000) });
  assert.equal(r.status, 502);
  assert.doesNotMatch(await r.text(), /stack trace/);
  step("inbox 429 message passed through; inbox 500 -> generic 502 (no leak); unknown kind -> feature");

  // 7. Per-IP limiter counts deliverable sends only: 3 forwarded above, the 4th is refused
  const before = received.length;
  r = await post({ message: "Fourth idea", t: ago(5000) });
  assert.equal(r.status, 429);
  assert.equal(received.length, before);
  step("4th deliverable suggestion in a minute -> 429, not forwarded (validation errors didn't count)");
} finally {
  inbox.close();
}
console.log(`\n${passed} checks passed`);
