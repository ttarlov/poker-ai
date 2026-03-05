"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";

export default function PointsSummary() {
  const { gameState } = useStore();
  const [expanded, setExpanded] = useState(false);

  const completedTickets = gameState.tickets.filter(t => t.status === "complete" && t.final_estimate);

  // Group completed tickets by created_by
  const byOwner: Record<string, { displayName: string; tickets: typeof completedTickets; total: number }> = {};

  for (const ticket of completedTickets) {
    const ownerId = ticket.created_by || "unknown";
    if (!byOwner[ownerId]) {
      const participant = gameState.participants.find(p => p.participant_id === ownerId);
      byOwner[ownerId] = {
        displayName: participant?.display_name || "Unknown",
        tickets: [],
        total: 0,
      };
    }
    byOwner[ownerId].tickets.push(ticket);
    const pts = parseFloat(ticket.final_estimate || "0");
    if (!isNaN(pts)) byOwner[ownerId].total += pts;
  }

  const owners = Object.entries(byOwner).sort(([, a], [, b]) => b.total - a.total);
  const grandTotal = owners.reduce((sum, [, o]) => sum + o.total, 0);

  if (completedTickets.length === 0) return null;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 transition-all"
        style={{ color: "var(--text-primary)" }}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Points by Owner</span>
          <div className="flex items-center gap-2">
            {owners.map(([ownerId, owner]) => (
              <span key={ownerId} className="text-xs px-2 py-0.5 rounded-full font-mono"
                    style={{ background: "color-mix(in srgb, var(--accent) 15%, transparent)", color: "var(--accent)" }}>
                {owner.displayName}: {owner.total}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-bold" style={{ color: "var(--accent)" }}>{grandTotal} pts</span>
          <span className="text-xs" style={{ color: "var(--text-muted)", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 animate-fade-in" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          {owners.map(([ownerId, owner]) => (
            <div key={ownerId} className="pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{owner.displayName}</span>
                <span className="font-mono text-sm" style={{ color: "var(--accent)" }}>
                  {owner.total} pts · {owner.tickets.length} {owner.tickets.length === 1 ? "ticket" : "tickets"}
                </span>
              </div>
              <div className="space-y-1">
                {owner.tickets.map(ticket => (
                  <div key={ticket.id} className="flex items-center justify-between px-3 py-1.5 rounded-lg text-sm"
                       style={{ background: "color-mix(in srgb, var(--bg-dark) 50%, transparent)" }}>
                    <span className="truncate mr-3" style={{ color: "var(--text-secondary)" }}>{ticket.title}</span>
                    <span className="font-mono shrink-0" style={{ color: "var(--accent)" }}>{ticket.final_estimate}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
