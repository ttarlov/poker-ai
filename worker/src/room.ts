import { DurableObject } from "cloudflare:workers";
import {
  LIMITS,
  type ClientMessage,
  type Participant,
  type RoomSnapshot,
  type ServerMessage,
  type Ticket,
  type Vote,
} from "../../shared/room-protocol";

// A room is deleted this long after its last activity once nobody is connected.
const IDLE_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredParticipant {
  display_name: string;
  joined_at: string;
  last_seen_at: string;
}

interface StoredRoom {
  code: string;
  name: string;
  createdAt: string;
  participants: Record<string, StoredParticipant>;
  tickets: Ticket[];
  currentTicketId: string | null;
  // ticketId -> participantId -> value
  votes: Record<string, Record<string, string>>;
}

interface Attachment {
  pid: string | null;
  code: string;
}

export interface Env {
  ROOM: DurableObjectNamespace<Room>;
  ALLOWED_ORIGINS: string;
  CONNECT_LIMITER?: RateLimit;
}

// Per-connection message budget: a burst of this many, refilled continuously.
const MSG_BURST = 30;
const MSG_REFILL_PER_SEC = 3;

export class Room extends DurableObject<Env> {
  private room: StoredRoom | null = null;
  // In-memory token buckets per socket; resets on hibernation, which is fine.
  private buckets = new WeakMap<WebSocket, { tokens: number; at: number }>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get<StoredRoom>("room")) ?? null;
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.endsWith("/exists")) {
      return Response.json(this.room ? { exists: true, name: this.room.name, code: this.room.code } : { exists: false });
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    // The Worker validated the code and forwards it; the DO is named after it.
    const code = request.headers.get("X-Room-Code") ?? "";
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ pid: null, code } satisfies Attachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (!this.takeToken(ws)) {
      this.sendError(ws, "bad_request", "Slow down");
      ws.close(4029, "rate_limited");
      return;
    }

    if (typeof raw !== "string" || raw.length > LIMITS.messageBytes) {
      return this.sendError(ws, "bad_request", "Message too large or not text");
    }

    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return this.sendError(ws, "bad_request", "Invalid JSON");
    }

    if (msg.t === "join") return this.handleJoin(ws, msg);

    const pid = this.attachment(ws).pid;
    const room = this.room;
    if (!room || !pid || !room.participants[pid]) {
      return this.sendError(ws, "not_joined", "Join the room first");
    }
    room.participants[pid].last_seen_at = new Date().toISOString();

    switch (msg.t) {
      case "addTicket": {
        const title = str(msg.title, LIMITS.title).trim();
        if (!title) return this.sendError(ws, "bad_request", "Ticket title is required");
        if (room.tickets.length >= LIMITS.tickets) return this.sendError(ws, "bad_request", "Ticket limit reached");
        room.tickets.push({
          id: crypto.randomUUID(),
          title,
          description: str(msg.description, LIMITS.description),
          status: "pending",
          final_estimate: null,
          display_order: room.tickets.length,
          created_by: pid,
          jira_key: msg.jiraKey ? str(msg.jiraKey, LIMITS.jiraKey) : null,
          external_url: msg.externalUrl ? str(msg.externalUrl, LIMITS.url) : null,
        });
        break;
      }
      case "startVoting": {
        const ticket = this.ticket(msg.ticketId);
        if (!ticket) return this.sendError(ws, "bad_request", "Unknown ticket");
        ticket.status = "voting";
        ticket.final_estimate = null;
        room.votes[ticket.id] = {};
        room.currentTicketId = ticket.id;
        break;
      }
      case "vote": {
        const ticket = this.ticket(msg.ticketId);
        if (!ticket || ticket.status !== "voting") return this.sendError(ws, "bad_request", "Ticket is not open for voting");
        const value = str(msg.value, LIMITS.voteValue);
        if (!value) return this.sendError(ws, "bad_request", "Empty vote");
        (room.votes[ticket.id] ??= {})[pid] = value;
        break;
      }
      case "reveal": {
        const ticket = this.ticket(msg.ticketId);
        if (!ticket || ticket.status !== "voting") return this.sendError(ws, "bad_request", "Ticket is not being voted on");
        ticket.status = "revealed";
        break;
      }
      case "lock": {
        const ticket = this.ticket(msg.ticketId);
        if (!ticket) return this.sendError(ws, "bad_request", "Unknown ticket");
        ticket.status = "complete";
        ticket.final_estimate = str(msg.estimate, LIMITS.voteValue) || null;
        break;
      }
      case "revote": {
        const ticket = this.ticket(msg.ticketId);
        if (!ticket) return this.sendError(ws, "bad_request", "Unknown ticket");
        ticket.status = "voting";
        ticket.final_estimate = null;
        room.votes[ticket.id] = {};
        room.currentTicketId = ticket.id;
        break;
      }
      case "leave": {
        delete room.participants[pid];
        ws.serializeAttachment({ ...this.attachment(ws), pid: null } satisfies Attachment);
        await this.save();
        this.broadcast();
        ws.close(1000, "left");
        return;
      }
      default:
        return this.sendError(ws, "bad_request", "Unknown message type");
    }

    await this.save();
    this.broadcast();
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    try {
      ws.close(code, reason);
    } catch {
      // already closed
    }
    this.broadcast(ws);
  }

  async webSocketError(ws: WebSocket) {
    this.broadcast(ws);
  }

  async alarm() {
    if (this.ctx.getWebSockets().length > 0) {
      await this.ctx.storage.setAlarm(Date.now() + IDLE_TTL_MS);
      return;
    }
    await this.ctx.storage.deleteAll();
    this.room = null;
  }

  // ── handlers ────────────────────────────────────────────────────────

  private async handleJoin(ws: WebSocket, msg: Extract<ClientMessage, { t: "join" }>) {
    const pid = str(msg.pid, 64);
    const name = str(msg.name, LIMITS.name).trim() || "Player";
    if (!pid) return this.sendError(ws, "bad_request", "Missing participant id");

    if (!this.room) {
      if (!msg.create) {
        this.sendError(ws, "not_found", "Room not found");
        ws.close(4004, "not_found");
        return;
      }
      this.room = {
        code: this.attachment(ws).code,
        name: str(msg.create.roomName, LIMITS.roomName).trim() || "Planning Session",
        createdAt: new Date().toISOString(),
        participants: {},
        tickets: [],
        currentTicketId: null,
        votes: {},
      };
    }

    const room = this.room;
    const now = new Date().toISOString();
    const existing = room.participants[pid];
    if (!existing && Object.keys(room.participants).length >= LIMITS.participants) {
      this.sendError(ws, "room_full", "This room is full");
      ws.close(4009, "room_full");
      return;
    }
    room.participants[pid] = {
      display_name: name,
      joined_at: existing?.joined_at ?? now,
      last_seen_at: now,
    };

    ws.serializeAttachment({ ...this.attachment(ws), pid } satisfies Attachment);
    await this.save();
    this.broadcast();
  }

  // ── helpers ─────────────────────────────────────────────────────────

  private takeToken(ws: WebSocket): boolean {
    const now = Date.now();
    const b = this.buckets.get(ws) ?? { tokens: MSG_BURST, at: now };
    b.tokens = Math.min(MSG_BURST, b.tokens + ((now - b.at) / 1000) * MSG_REFILL_PER_SEC);
    b.at = now;
    if (b.tokens < 1) {
      this.buckets.set(ws, b);
      return false;
    }
    b.tokens -= 1;
    this.buckets.set(ws, b);
    return true;
  }

  private ticket(id: unknown): Ticket | undefined {
    return this.room?.tickets.find(t => t.id === id);
  }

  private attachment(ws: WebSocket): Attachment {
    return (ws.deserializeAttachment() as Attachment | null) ?? { pid: null, code: "" };
  }

  private async save() {
    if (!this.room) return;
    await this.ctx.storage.put("room", this.room);
    await this.ctx.storage.setAlarm(Date.now() + IDLE_TTL_MS);
  }

  private onlinePids(exclude?: WebSocket): Set<string> {
    const pids = new Set<string>();
    for (const sock of this.ctx.getWebSockets()) {
      if (sock === exclude) continue;
      const pid = this.attachment(sock).pid;
      if (pid) pids.add(pid);
    }
    return pids;
  }

  private snapshotFor(viewerPid: string, online: Set<string>): RoomSnapshot {
    const room = this.room!;
    const participants: Participant[] = Object.entries(room.participants)
      .map(([pid, p]) => ({
        id: pid,
        participant_id: pid,
        display_name: p.display_name,
        joined_at: p.joined_at,
        last_seen_at: p.last_seen_at,
        online: online.has(pid),
      }))
      .sort((a, b) => a.joined_at.localeCompare(b.joined_at));

    const votes: Record<string, Vote[]> = {};
    for (const ticket of room.tickets) {
      const byPid = room.votes[ticket.id] ?? {};
      // Hide other people's values until the ticket is revealed.
      const hidden = ticket.status === "voting";
      votes[ticket.id] = Object.entries(byPid).map(([pid, value]) => ({
        id: `${ticket.id}:${pid}`,
        ticket_id: ticket.id,
        participant_id: pid,
        value: hidden && pid !== viewerPid ? "" : value,
      }));
    }

    return {
      roomCode: room.code,
      roomName: room.name,
      participants,
      tickets: room.tickets,
      currentTicketId: room.currentTicketId,
      votes,
    };
  }

  private broadcast(exclude?: WebSocket) {
    if (!this.room) return;
    const online = this.onlinePids(exclude);
    for (const sock of this.ctx.getWebSockets()) {
      if (sock === exclude) continue;
      const pid = this.attachment(sock).pid;
      if (!pid) continue;
      this.send(sock, { t: "state", state: this.snapshotFor(pid, online) });
    }
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // socket went away mid-send; the close handler will clean up
    }
  }

  private sendError(ws: WebSocket, code: Extract<ServerMessage, { t: "error" }>["code"], message: string) {
    this.send(ws, { t: "error", code, message });
  }
}

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}
