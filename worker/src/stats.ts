import { DurableObject } from "cloudflare:workers";
import type { Env } from "./room";

// Anonymous usage counters: one row per (UTC day, event) holding a number.
// Nothing else is stored: no IPs, participant ids, room codes, names, tickets or votes.
export const STAT_EVENTS = [
  "room_created_web",
  "room_created_slack",
  "room_used", // a room reached 2 people (counted once per room)
  "person_joined", // a new person entered a room (reconnects don't count)
  "vote_cast",
  "cards_revealed",
  "estimate_locked",
  "suggestion_sent",
] as const;
export type StatEvent = (typeof STAT_EVENTS)[number];

const MAX_DAYS = 400;

export interface StatsReport {
  events: readonly StatEvent[];
  totals: Partial<Record<StatEvent, number>>;
  days: { day: string; counts: Partial<Record<StatEvent, number>> }[];
}

export class Stats extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS counts (day TEXT NOT NULL, event TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, event))",
    );
  }

  async bump(event: StatEvent): Promise<void> {
    if (!STAT_EVENTS.includes(event)) return;
    const day = new Date().toISOString().slice(0, 10);
    this.ctx.storage.sql.exec(
      "INSERT INTO counts (day, event, n) VALUES (?, ?, 1) ON CONFLICT (day, event) DO UPDATE SET n = n + 1",
      day,
      event,
    );
  }

  async report(days: number): Promise<StatsReport> {
    const span = Math.max(1, Math.min(MAX_DAYS, Math.floor(days) || 30));
    const since = new Date(Date.now() - (span - 1) * 86_400_000).toISOString().slice(0, 10);

    const totals: StatsReport["totals"] = {};
    for (const row of this.ctx.storage.sql.exec<{ event: StatEvent; n: number }>(
      "SELECT event, SUM(n) AS n FROM counts GROUP BY event",
    )) {
      totals[row.event] = row.n;
    }

    const byDay = new Map<string, Partial<Record<StatEvent, number>>>();
    for (const row of this.ctx.storage.sql.exec<{ day: string; event: StatEvent; n: number }>(
      "SELECT day, event, n FROM counts WHERE day >= ? ORDER BY day DESC",
      since,
    )) {
      const counts = byDay.get(row.day) ?? {};
      counts[row.event] = row.n;
      byDay.set(row.day, counts);
    }

    return { events: STAT_EVENTS, totals, days: [...byDay].map(([day, counts]) => ({ day, counts })) };
  }
}

function statsStub(env: Env) {
  return env.STATS.get(env.STATS.idFromName("global"));
}

// Fire-and-forget: a counter failure must never break a room. Pass the result to waitUntil.
export function count(env: Env, event: StatEvent): Promise<void> {
  if (!env.STATS) return Promise.resolve();
  return statsStub(env).bump(event).catch(() => {});
}

// GET /stats       the owner's dashboard page (it asks for STATS_TOKEN)
// GET /stats/data  JSON report, Authorization: Bearer <STATS_TOKEN>
export async function handleStats(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const noStore = { "Cache-Control": "no-store" };

  if (url.pathname === "/stats") {
    return new Response(STATS_PAGE, {
      headers: {
        ...noStore,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'",
        "X-Robots-Tag": "noindex",
      },
    });
  }
  if (url.pathname !== "/stats/data") return new Response("Not found", { status: 404 });

  if (!env.STATS_TOKEN) return Response.json({ error: "Stats are not configured" }, { status: 503, headers: noStore });
  const auth = request.headers.get("Authorization") ?? "";
  const given = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!(await tokenMatches(given, env.STATS_TOKEN))) {
    return Response.json({ error: "Wrong token" }, { status: 401, headers: noStore });
  }

  const days = Number(url.searchParams.get("days") ?? 30);
  return Response.json(await statsStub(env).report(days), { headers: noStore });
}

async function tokenMatches(given: string, expected: string): Promise<boolean> {
  // Hash both sides so the comparison is fixed-length and constant-time.
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(given)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  return given.length > 0 && crypto.subtle.timingSafeEqual(a, b);
}

const STATS_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>AgilePoker stats</title>
<style>
:root{--bg:#F8F2E9;--card:#fff;--ink:#111;--muted:#6b6b6b;--line:#e4dccf;--accent:#E7651C}
@media (prefers-color-scheme:dark){:root{--bg:#14110e;--card:#1e1a16;--ink:#f2ece4;--muted:#a49a8e;--line:#352e27}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,-apple-system,sans-serif;padding:24px 16px}
main{max-width:860px;margin:0 auto}h1{font-weight:600;margin:0 0 4px}h1 span{color:var(--accent)}
p.sub{color:var(--muted);margin:0 0 24px}
form{display:flex;gap:8px;flex-wrap:wrap}input,select,button{font:inherit;padding:8px 12px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink)}
input{flex:1;min-width:200px}button{background:var(--accent);border-color:var(--accent);color:#fff;cursor:pointer}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin:20px 0}
.tile{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.tile b{display:block;font-size:26px;font-variant-numeric:tabular-nums}.tile small{color:var(--muted)}
.wrap{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:10px}
table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}
th,td{padding:7px 10px;text-align:right;border-bottom:1px solid var(--line);white-space:nowrap}
th:first-child,td:first-child{text-align:left}th{font-weight:600;color:var(--muted);font-size:13px}
.err{color:#c0392b;margin-top:10px}.hidden{display:none}
</style></head><body><main>
<h1>Agile<span>Poker</span> stats</h1>
<p class="sub">Anonymous daily counts. Days are UTC.</p>
<form id="f"><input id="tok" type="password" placeholder="Stats token" autocomplete="current-password">
<select id="days"><option value="7">7 days</option><option value="30" selected>30 days</option><option value="90">90 days</option><option value="365">365 days</option></select>
<button>Load</button></form>
<div id="err" class="err"></div>
<section id="out" class="hidden"><div class="tiles" id="tiles"></div><div class="wrap"><table id="tbl"></table></div></section>
</main><script>
const LABELS={room_created_web:"Rooms (web)",room_created_slack:"Rooms (Slack)",room_used:"Rooms with 2+ people",person_joined:"People joined",vote_cast:"Votes cast",cards_revealed:"Reveals",estimate_locked:"Estimates locked",suggestion_sent:"Suggestions"};
const $=id=>document.getElementById(id);
let saved="";try{saved=localStorage.getItem("statsToken")||""}catch(e){}
$("tok").value=saved;
async function load(){
  $("err").textContent="";
  const token=$("tok").value.trim();if(!token)return;
  const res=await fetch("/stats/data?days="+$("days").value,{headers:{Authorization:"Bearer "+token}});
  const data=await res.json().catch(()=>({}));
  if(!res.ok){$("err").textContent=data.error||("Error "+res.status);$("out").classList.add("hidden");return}
  try{localStorage.setItem("statsToken",token)}catch(e){}
  const ev=data.events, inRange={};
  for(const d of data.days)for(const e of ev)inRange[e]=(inRange[e]||0)+(d.counts[e]||0);
  $("tiles").innerHTML="";
  for(const e of ev){const t=document.createElement("div");t.className="tile";
    t.innerHTML="<small></small><b></b><small></small>";
    t.children[0].textContent=LABELS[e]||e;t.children[1].textContent=(inRange[e]||0).toLocaleString();
    t.children[2].textContent=(data.totals[e]||0).toLocaleString()+" all time";$("tiles").append(t)}
  const tbl=$("tbl");tbl.innerHTML="";
  const head=tbl.insertRow();for(const h of ["Day",...ev.map(e=>LABELS[e]||e)]){const th=document.createElement("th");th.textContent=h;head.append(th)}
  if(!data.days.length){const r=tbl.insertRow();const c=r.insertCell();c.colSpan=ev.length+1;c.textContent="No activity in this range yet."}
  for(const d of data.days){const r=tbl.insertRow();r.insertCell().textContent=d.day;for(const e of ev)r.insertCell().textContent=d.counts[e]||""}
  $("out").classList.remove("hidden");
}
$("f").addEventListener("submit",e=>{e.preventDefault();load()});
$("days").addEventListener("change",load);
if(saved)load();
</script></body></html>`;
