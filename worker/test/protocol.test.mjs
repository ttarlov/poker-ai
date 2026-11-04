// End-to-end protocol test against `wrangler dev` (default http://localhost:8787).
// Run: npm run dev  (in one shell), then  npm run test:protocol
import assert from "node:assert/strict";

const BASE = process.env.ROOMS_URL || "http://localhost:8787";
const WS_BASE = BASE.replace(/^http/, "ws");
const ORIGIN = "http://localhost:3000";
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const code = () => {
  let c = "";
  for (let i = 0; i < 8; i++) c += (i === 4 ? "-" : "") + ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return c;
};

class Client {
  constructor(room, pid, name) {
    this.room = room; this.pid = pid; this.name = name;
    this.states = []; this.errors = []; this.waiters = [];
  }
  open() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${WS_BASE}/rooms/${this.room}`, { headers: { Origin: ORIGIN } });
      this.ws.onopen = () => resolve(this);
      this.ws.onerror = e => reject(e);
      this.ws.onclose = e => { this.closed = e; };
      this.ws.onmessage = ev => {
        const msg = JSON.parse(ev.data);
        if (msg.t === "state") this.states.push(msg.state); else this.errors.push(msg);
        this.waiters = this.waiters.filter(w => !w(msg));
      };
    });
  }
  send(msg) { this.ws.send(JSON.stringify(msg)); }
  get state() { return this.states.at(-1); }
  // Wait until a message satisfies pred (checks already-received state first).
  until(pred, label, ms = 3000) {
    const last = this.state;
    if (last && pred({ t: "state", state: last })) return Promise.resolve(last);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout: ${this.name} waiting for ${label}`)), ms);
      this.waiters.push(msg => {
        if (!pred(msg)) return false;
        clearTimeout(timer); resolve(msg.state ?? msg); return true;
      });
    });
  }
  close() { this.ws.close(); }
}

const st = fn => m => m.t === "state" && fn(m.state);
let passed = 0;
const step = (name) => { passed++; console.log(`  ✓ ${name}`); };

const room = code();
console.log(`room ${room}`);

// 1. Unknown room: exists=false, join without create -> not_found + close
let r = await fetch(`${BASE}/rooms/${room}/exists`, { headers: { Origin: ORIGIN } });
assert.equal(r.headers.get("access-control-allow-origin"), ORIGIN);
assert.deepEqual(await r.json(), { exists: false });
const ghost = await new Client(room, "ghost", "Ghost").open();
ghost.send({ t: "join", pid: "ghost", name: "Ghost" });
await ghost.until(m => m.t === "error" && m.code === "not_found", "not_found");
step("joining a missing room is refused");

// 2. Bad code and foreign origin are rejected
r = await fetch(`${BASE}/rooms/bad/exists`);
assert.equal(r.status, 400);
r = await fetch(`${BASE}/rooms/${room}/exists`, { headers: { Origin: "https://evil.example" } });
assert.equal(r.status, 403);
step("bad codes and unlisted origins are rejected");

// 3. Create + join three players
const alice = await new Client(room, "pid-alice", "Alice").open();
alice.send({ t: "join", pid: "pid-alice", name: "Alice", create: { roomName: "Sprint 1" } });
await alice.until(st(s => s.roomName === "Sprint 1" && s.participants.length === 1), "create");
r = await fetch(`${BASE}/rooms/${room}/exists`);
assert.deepEqual(await r.json(), { exists: true, name: "Sprint 1", code: room });
const bob = await new Client(room, "pid-bob", "Bob").open();
bob.send({ t: "join", pid: "pid-bob", name: "Bob" });
const cara = await new Client(room, "pid-cara", "Cara").open();
cara.send({ t: "join", pid: "pid-cara", name: "Cara" });
await alice.until(st(s => s.participants.length === 3 && s.participants.every(p => p.online)), "3 online");
step("room created; three players joined and show online");

// 4. Ticket + voting; values hidden from others until reveal
alice.send({ t: "addTicket", title: "Login page", description: "OAuth" });
const s1 = await bob.until(st(s => s.tickets.length === 1), "ticket");
const tid = s1.tickets[0].id;
assert.equal(s1.tickets[0].created_by, "pid-alice");
bob.send({ t: "startVoting", ticketId: tid });
await cara.until(st(s => s.currentTicketId === tid && s.tickets[0].status === "voting"), "voting");
alice.send({ t: "vote", ticketId: tid, value: "3" });
bob.send({ t: "vote", ticketId: tid, value: "5" });
const seenByCara = await cara.until(st(s => (s.votes[tid] || []).length === 2), "2 votes");
assert.ok(seenByCara.votes[tid].every(v => v.value === ""), "cara must not see values before reveal");
const seenByAlice = await alice.until(st(s => (s.votes[tid] || []).length === 2), "alice 2 votes");
assert.equal(seenByAlice.votes[tid].find(v => v.participant_id === "pid-alice").value, "3");
assert.equal(seenByAlice.votes[tid].find(v => v.participant_id === "pid-bob").value, "");
step("votes counted; values hidden from everyone but the voter");

// 5. Disconnect + rejoin keeps identity and vote
bob.close();
await alice.until(st(s => s.participants.find(p => p.participant_id === "pid-bob")?.online === false), "bob offline");
const bob2 = await new Client(room, "pid-bob", "Bob").open();
bob2.send({ t: "join", pid: "pid-bob", name: "Bob" });
const back = await bob2.until(st(s => s.participants.length === 3), "bob back");
assert.equal(back.votes[tid].find(v => v.participant_id === "pid-bob").value, "5", "bob's own vote survives rejoin");
await alice.until(st(s => s.participants.every(p => p.online)), "all online again");
step("disconnect shows offline; rejoin restores identity and own vote");

// 6. Reveal shows everything; lock; revote clears
cara.send({ t: "reveal", ticketId: tid });
const rev = await cara.until(st(s => s.tickets[0].status === "revealed"), "revealed");
assert.deepEqual(rev.votes[tid].map(v => v.value).sort(), ["3", "5"]);
alice.send({ t: "revote", ticketId: tid });
await bob2.until(st(s => s.tickets[0].status === "voting" && s.votes[tid].length === 0), "revote cleared");
bob2.send({ t: "vote", ticketId: tid, value: "3" });
alice.send({ t: "vote", ticketId: tid, value: "3" });
await alice.until(st(s => s.votes[tid].length === 2), "re-voted");
alice.send({ t: "reveal", ticketId: tid });
alice.send({ t: "lock", ticketId: tid, estimate: "3" });
await bob2.until(st(s => s.tickets[0].status === "complete" && s.tickets[0].final_estimate === "3"), "locked");
step("reveal, revote, and lock estimate sync to everyone");

// 7. Validation: vote on closed ticket, actions before join, leave
alice.send({ t: "vote", ticketId: tid, value: "8" });
await alice.until(m => m.t === "error" && m.code === "bad_request", "closed-ticket error");
const lurker = await new Client(room, "lurker", "Lurker").open();
lurker.send({ t: "addTicket", title: "sneaky", description: "" });
await lurker.until(m => m.t === "error" && m.code === "not_joined", "not_joined");
cara.send({ t: "leave" });
await alice.until(st(s => s.participants.length === 2 && !s.participants.some(p => p.participant_id === "pid-cara")), "cara left");
step("invalid actions refused; leave removes the participant");

// 8. Isolation: a second room sees none of the first
const other = code();
const zed = await new Client(other, "pid-zed", "Zed").open();
zed.send({ t: "join", pid: "pid-zed", name: "Zed", create: { roomName: "Other team" } });
const os = await zed.until(st(s => s.roomCode === other), "other room");
assert.equal(os.tickets.length, 0);
assert.deepEqual(os.participants.map(p => p.display_name), ["Zed"]);
step("a second room is fully isolated");

for (const c of [alice, bob2, lurker, zed, ghost]) try { c.close(); } catch {}
console.log(`\n${passed} checks passed`);
process.exit(0);
