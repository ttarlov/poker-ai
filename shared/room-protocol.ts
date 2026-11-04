// Wire protocol between the Next.js client and the Cloudflare room Durable Object.
// Imported by both sides; keep it dependency-free.

export type TicketStatus = "pending" | "voting" | "revealed" | "complete";

export interface Participant {
  id: string;
  participant_id: string;
  display_name: string;
  joined_at: string;
  last_seen_at: string;
  online: boolean;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  final_estimate: string | null;
  display_order: number;
  created_by: string | null;
  jira_key: string | null;
  external_url: string | null;
}

export interface Vote {
  id: string;
  ticket_id: string;
  participant_id: string;
  // Empty string while the ticket is still being voted on and the vote isn't yours.
  value: string;
}

export interface RoomSnapshot {
  roomCode: string;
  roomName: string;
  participants: Participant[];
  tickets: Ticket[];
  currentTicketId: string | null;
  votes: Record<string, Vote[]>;
}

export type ClientMessage =
  | { t: "join"; pid: string; name: string; create?: { roomName: string } }
  | { t: "addTicket"; title: string; description: string; jiraKey?: string; externalUrl?: string }
  | { t: "startVoting"; ticketId: string }
  | { t: "vote"; ticketId: string; value: string }
  | { t: "reveal"; ticketId: string }
  | { t: "lock"; ticketId: string; estimate: string }
  | { t: "revote"; ticketId: string }
  | { t: "leave" };

export type ServerMessage =
  | { t: "state"; state: RoomSnapshot }
  | { t: "error"; code: "not_found" | "bad_request" | "room_full" | "not_joined"; message: string };

// Room codes: XXXX-XXXX from an unambiguous alphabet (31^8 ≈ 8.5e11 combinations).
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/;

export function generateRoomCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += "-";
    code += ROOM_CODE_ALPHABET[bytes[i] % ROOM_CODE_ALPHABET.length];
  }
  return code;
}

export const LIMITS = {
  participants: 50,
  tickets: 200,
  name: 48,
  roomName: 120,
  title: 255,
  description: 5000,
  voteValue: 10,
  url: 512,
  jiraKey: 20,
  messageBytes: 16 * 1024,
} as const;
