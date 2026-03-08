"use client";

import { useState } from "react";

interface Ticket {
  id: string; title: string; description: string;
  status: string; final_estimate: string | null;
}

export default function SessionSummary({ tickets, onClose }: { tickets: Ticket[]; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const completedTickets = tickets.filter(t => t.status === "complete" && t.final_estimate);
  const totalPoints = completedTickets.reduce((sum, t) => {
    const n = parseFloat(t.final_estimate || "0");
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  const handleCopy = () => {
    const lines = [
      "📊 Pointing Session Summary",
      "═══════════════════════════",
      "",
      ...completedTickets.map((t, i) => `${i + 1}. ${t.title} → ${t.final_estimate} pts`),
      "",
      `Total: ${totalPoints} points across ${completedTickets.length} tickets`,
      `Average: ${completedTickets.length > 0 ? (totalPoints / completedTickets.length).toFixed(1) : 0} pts/ticket`,
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl" style={{ color: "var(--text-primary)" }}>Session Summary</h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {completedTickets.length} tickets pointed · {totalPoints} total points
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleCopy}
            className="px-4 py-2 text-sm rounded-full transition-all"
            style={{
              background: copied ? "color-mix(in srgb, var(--status-active) 20%, transparent)" : "color-mix(in srgb, var(--accent) 20%, transparent)",
              color: copied ? "var(--status-active)" : "var(--accent)",
              border: copied ? "1px solid color-mix(in srgb, var(--status-active) 40%, transparent)" : "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
            }}>
            {copied ? "✓ Copied!" : "Copy Summary"}
          </button>
          <button onClick={onClose}
            className="px-4 py-2 text-sm rounded-full transition-all"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--border-medium)" }}>Back</button>
        </div>
      </div>

      <div className="space-y-3">
        {tickets.map((ticket, i) => (
          <div key={ticket.id} className="flex items-center gap-4 p-4 rounded-sm shadow-sm"
            style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)" }}>
            <span className="font-mono text-sm w-6 text-right" style={{ color: "var(--text-muted)" }}>{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="truncate" style={{ color: "var(--text-primary)" }}>{ticket.title}</p>
            </div>
            {ticket.final_estimate ? (
              <span className="font-mono text-lg font-bold px-3 py-1 rounded-lg"
                    style={{ color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 10%, transparent)" }}>
                {ticket.final_estimate}
              </span>
            ) : (
              <span className="text-sm italic" style={{ color: "var(--text-muted)" }}>
                {ticket.status === "pending" ? "Not pointed" : ticket.status}
              </span>
            )}
          </div>
        ))}
      </div>

      {completedTickets.length > 0 && (
        <div className="mt-8 flex justify-center gap-12 text-center">
          <div>
            <div className="font-display text-3xl" style={{ color: "var(--accent)" }}>{totalPoints}</div>
            <div className="text-xs uppercase tracking-wider mt-1" style={{ color: "var(--text-muted)" }}>Total Points</div>
          </div>
          <div>
            <div className="font-display text-3xl" style={{ color: "var(--text-primary)" }}>
              {(totalPoints / completedTickets.length).toFixed(1)}
            </div>
            <div className="text-xs uppercase tracking-wider mt-1" style={{ color: "var(--text-muted)" }}>Avg / Ticket</div>
          </div>
          <div>
            <div className="font-display text-3xl" style={{ color: "var(--text-primary)" }}>{completedTickets.length}</div>
            <div className="text-xs uppercase tracking-wider mt-1" style={{ color: "var(--text-muted)" }}>Tickets</div>
          </div>
        </div>
      )}
    </div>
  );
}
