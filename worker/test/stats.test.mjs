// Usage counters test against `wrangler dev` (default http://localhost:8787).
// Needs STATS_TOKEN=local-stats-token in worker/.dev.vars.
// Run: npm run dev  (in one shell), then  npm run test:stats
import assert from "node:assert/strict";

const BASE = process.env.ROOMS_URL || "http://localhost:8787";
const WS_BASE = BASE.replace(/^http/, "ws");
const ORIGIN = "http://localhost:3000";
const TOKEN = process.env.STATS_TOKEN || "local-stats-token";
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const code = () => {
  let c = "";
  for (let i = 0; i < 8; i++) c += (i === 4 ? "-" : "") + ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return c;
};
let passed = 0;
const step = name => { passed++; console.log(`  ✓ ${name}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const report = async () => {
  const r = await fetch(`${BASE}/stats/data?days=7`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  assert.equal(r.status, 200);
  return r.json();
};
const totals = rep => rep.totals;

function connect(room) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_BASE}/rooms/${room}`, { headers: { Origin: ORIGIN } });
    const c = { ws, states: [], send: m => ws.send(JSON.stringify(m)) };
    ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.t === "state") c.states.push(m.state); };
    ws.onopen = () => resolve(c);
    ws.onerror = reject;
  });
}
const until = async (c, pred, label) => {
  for (let i = 0; i < 60; i++) { if (c.states.length && pred(c.states.at(-1))) return c.states.at(-1); await sleep(50); }
  throw new Error("timeout: " + label);
};

// 1. Auth: no token, wrong token, page loads without one
assert.equal((await fetch(`${BASE}/stats/data`)).status, 401);
assert.equal((await fetch(`${BASE}/stats/data`, { headers: { Authorization: "Bearer nope" } })).status, 401);
const page = await fetch(`${BASE}/stats`);
assert.equal(page.status, 200);
assert.match(await page.text(), /AgilePoker/);
assert.equal(page.headers.get("x-robots-tag"), "noindex");
step("stats data needs the token; page is public and noindex");

// 2. A full round bumps exactly the expected counters
const before = totals(await report());
const n = e => before[e] || 0;
const room = code();
const alice = await connect(room);
alice.send({ t: "join", pid: "pid-a", name: "Alice", create: { roomName: "Stats test" } });
await until(alice, s => s.participants.length === 1, "alice joined");
const bob = await connect(room);
bob.send({ t: "join", pid: "pid-b", name: "Bob" });
await until(alice, s => s.participants.length === 2, "bob joined");
alice.send({ t: "addTicket", title: "Secret project name", description: "" });
const tid = (await until(alice, s => s.tickets.length === 1, "ticket")).tickets[0].id;
alice.send({ t: "startVoting", ticketId: tid });
await until(alice, s => s.tickets[0].status === "voting", "voting");
alice.send({ t: "vote", ticketId: tid, value: "3" });
bob.send({ t: "vote", ticketId: tid, value: "5" });
await sleep(200);
alice.send({ t: "reveal", ticketId: tid });
await until(alice, s => s.tickets[0].status === "revealed", "revealed");
alice.send({ t: "lock", ticketId: tid, estimate: "3" });
await until(alice, s => s.tickets[0].status === "complete", "locked");

// Reconnect as the same person: must not count as a new join or a new "used" room
bob.ws.close();
const bob2 = await connect(room);
bob2.send({ t: "join", pid: "pid-b", name: "Bob" });
await until(bob2, s => s.participants.length === 2, "bob rejoined");
await sleep(300);

const after = await report();
const t = totals(after);
assert.equal((t.room_created_web || 0) - n("room_created_web"), 1);
assert.equal((t.person_joined || 0) - n("person_joined"), 2);
assert.equal((t.room_used || 0) - n("room_used"), 1);
assert.equal((t.vote_cast || 0) - n("vote_cast"), 2);
assert.equal((t.cards_revealed || 0) - n("cards_revealed"), 1);
assert.equal((t.estimate_locked || 0) - n("estimate_locked"), 1);
step("one round: +1 room, +2 people, +1 used room, +2 votes, +1 reveal, +1 lock; reconnect not recounted");

// 3. The report holds only day strings, event names and numbers
const today = new Date().toISOString().slice(0, 10);
assert.equal(after.days[0].day, today);
const raw = JSON.stringify(after);
assert.ok(!raw.includes(room) && !raw.includes("Secret project") && !raw.includes("Alice") && !raw.includes("pid-"));
for (const d of after.days) for (const v of Object.values(d.counts)) assert.equal(typeof v, "number");
step("report contains no room codes, names, ticket text or ids");

alice.ws.close(); bob2.ws.close();
console.log(`\n${passed} checks passed`);
