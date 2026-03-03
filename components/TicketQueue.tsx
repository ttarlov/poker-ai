"use client";

interface Ticket {
  id: string; title: string;
  status: "pending" | "voting" | "revealed" | "complete";
  final_estimate: string | null;
}

export default function TicketQueue({ tickets, currentTicketId }: { tickets: Ticket[]; currentTicketId: string | null }) {
  if (tickets.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {tickets.map((ticket) => {
        const isCurrent = ticket.id === currentTicketId;
        const isVoting = ticket.status === "voting";
        return (
          <div key={ticket.id}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg shrink-0 text-sm transition-all duration-200"
            style={{
              background: isCurrent ? "color-mix(in srgb, var(--accent) 15%, transparent)" : "var(--input-bg)",
              border: isCurrent ? "1px solid color-mix(in srgb, var(--accent) 30%, transparent)" : "1px solid var(--border-subtle)",
              color: isCurrent ? "var(--accent)" : "var(--text-secondary)",
            }}>
            <div className={`w-2 h-2 rounded-full shrink-0 ${isVoting ? "animate-pulse" : ""}`}
                 style={{
                   background: ticket.status === "complete" ? "var(--status-active)"
                     : ticket.status === "voting" ? "var(--status-idle)"
                     : ticket.status === "revealed" ? "var(--accent-light)"
                     : "var(--status-offline)",
                 }} />
            <span className="truncate max-w-[120px]">{ticket.title}</span>
            {ticket.final_estimate && (
              <span className="font-mono text-xs px-1.5 py-0.5 rounded ml-1"
                    style={{ background: "color-mix(in srgb, var(--status-active) 20%, transparent)", color: "var(--status-active)" }}>
                {ticket.final_estimate}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
