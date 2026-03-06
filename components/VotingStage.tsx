"use client";

import { useState, useMemo, useEffect } from "react";
import { useStore } from "@/lib/store";

const POINT_SCALE = ["0.5", "1", "2", "3", "4", "5"];

function closestPoint(avg: number): string {
  const points = POINT_SCALE.map(Number);
  let closest = points[0];
  let minDiff = Math.abs(avg - closest);
  for (const p of points) {
    const diff = Math.abs(avg - p);
    if (diff < minDiff) {
      minDiff = diff;
      closest = p;
    }
  }
  return closest === 0.5 ? "0.5" : String(closest);
}

export default function VotingStage() {
  const { gameState, myParticipantId, startVoting, revealVotes, lockEstimate, revote } = useStore();
  const [selectedEstimate, setSelectedEstimate] = useState<string | null>(null);

  const currentTicket = gameState.tickets.find(t => t.id === gameState.currentTicketId);
  const nextPendingTicket = gameState.tickets.find(
    t => t.status === "pending" && t.id !== gameState.currentTicketId
  );

  const ticketVotes = currentTicket ? (gameState.votes[currentTicket.id] || []) : [];

  const revealedData = useMemo(() => {
    if (!currentTicket || currentTicket.status !== "revealed") return null;
    const votes = ticketVotes.map(v => {
      const participant = gameState.participants.find(p => p.participant_id === v.participant_id);
      return { participantId: v.participant_id, displayName: participant?.display_name || "Unknown", value: v.value };
    });
    const numericVotes = votes.map(v => parseFloat(v.value)).filter(v => !isNaN(v));
    const stats = numericVotes.length > 0 ? {
      average: Math.round((numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length) * 10) / 10,
      min: Math.min(...numericVotes),
      max: Math.max(...numericVotes),
    } : null;
    return { votes, stats };
  }, [currentTicket, ticketVotes, gameState.participants]);

  useEffect(() => {
    if (revealedData && revealedData.stats) {
      setSelectedEstimate(closestPoint(revealedData.stats.average));
    }
  }, [revealedData]);

  useEffect(() => {
    setSelectedEstimate(null);
  }, [gameState.currentTicketId]);

  if (!currentTicket && gameState.tickets.length > 0) {
    const firstPending = gameState.tickets.find(t => t.status === "pending");
    if (!firstPending) return null;
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-12">
        <TicketDisplay ticket={firstPending} />
        <button onClick={() => startVoting(firstPending.id)}
          className="mt-8 px-8 py-3 font-bold text-lg rounded-xl hover:shadow-lg hover:scale-105 active:scale-95 transition-all"
          style={{ background: "linear-gradient(to right, var(--btn-primary-from), var(--btn-primary-to))", color: "var(--btn-primary-text)" }}>
          Start Voting
        </button>
      </div>
    );
  }
  if (!currentTicket) return null;

  const votedPids = new Set(ticketVotes.map(v => v.participant_id));

  return (
    <div className="flex-1 flex flex-col">
      <TicketDisplay ticket={currentTicket} />

      {currentTicket.status === "voting" && (
        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
            {gameState.participants.map(p => {
              const hasVoted = votedPids.has(p.participant_id);
              return (
                <div key={p.id} className="flex flex-col items-center gap-2">
                  <div className={"w-16 h-24 rounded-xl border-2 flex items-center justify-center transition-all duration-300 " + (!hasVoted ? "border-dashed animate-pulse-soft" : "shadow-lg vote-facedown")}
                    style={{
                      background: hasVoted ? "var(--voted-card-bg)" : "var(--unvoted-bg)",
                      borderColor: hasVoted ? "var(--voted-card-border)" : "var(--unvoted-border)",
                    }}>
                    {hasVoted
                      ? <div className="text-2xl">🂠</div>
                      : <div className="text-xs" style={{ color: "var(--text-muted)" }}>...</div>}
                  </div>
                  <span className="text-xs" style={{ color: hasVoted ? "var(--accent-light)" : "var(--text-muted)" }}>
                    {p.display_name}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="text-center text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
            {ticketVotes.length} / {gameState.participants.length} voted
          </div>
          <div className="flex justify-center">
            <button onClick={() => revealVotes(currentTicket.id)} disabled={ticketVotes.length === 0}
              className="px-8 py-3 font-bold rounded-xl hover:shadow-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              style={{ background: "var(--accent-dark)", color: "var(--text-on-accent)" }}>
              Reveal Cards
            </button>
          </div>
        </div>
      )}

      {currentTicket.status === "revealed" && revealedData && (
        <div className="mt-8 animate-fade-in">
          <div className="flex flex-wrap items-end justify-center gap-4 mb-8">
            {revealedData.votes.map((v, i) => (
              <div key={v.participantId} className="flex flex-col items-center gap-2">
                <div className="w-16 h-24 rounded-xl border-2 flex items-center justify-center animate-bounce-in shadow-lg"
                  style={{
                    background: "var(--card-face)",
                    borderColor: "color-mix(in srgb, var(--accent) 40%, transparent)",
                    animationDelay: i * 80 + "ms",
                  }}>
                  <span className="font-display text-2xl font-bold" style={{ color: "var(--card-text)" }}>{v.value}</span>
                </div>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{v.displayName}</span>
              </div>
            ))}
          </div>

          {revealedData.stats && (
            <div className="flex items-center justify-center gap-8 mb-8 text-sm">
              <div className="text-center">
                <div className="font-display text-3xl" style={{ color: "var(--accent)" }}>{revealedData.stats.average}</div>
                <div className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Average</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-xl" style={{ color: "var(--text-primary)" }}>{revealedData.stats.min}</div>
                <div className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Low</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-xl" style={{ color: "var(--text-primary)" }}>{revealedData.stats.max}</div>
                <div className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>High</div>
              </div>
            </div>
          )}

          {revealedData.votes.length > 0 && <VoteDistribution votes={revealedData.votes} />}

          <div className="flex flex-col items-center gap-4 mt-6">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-sm mr-2" style={{ color: "var(--text-secondary)" }}>Lock estimate:</span>
              {POINT_SCALE.map(val => (
                <button key={val} onClick={() => setSelectedEstimate(val)}
                  className="w-10 h-10 rounded-lg font-mono text-sm font-bold transition-all"
                  style={{
                    background: selectedEstimate === val ? "var(--accent)" : "var(--input-bg)",
                    color: selectedEstimate === val ? "var(--text-on-accent)" : "var(--text-primary)",
                    border: selectedEstimate === val ? "2px solid var(--accent-light)" : "1px solid var(--border-medium)",
                  }}>
                  {val}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => revote(currentTicket.id)}
                className="px-6 py-2.5 rounded-xl text-sm transition-all"
                style={{ color: "var(--btn-danger-text)", border: "1px solid var(--btn-danger-border)" }}>
                Re-vote
              </button>
              <button onClick={async () => {
                  if (selectedEstimate) {
                    await lockEstimate(currentTicket.id, selectedEstimate);
                    setSelectedEstimate(null);
                    if (nextPendingTicket) setTimeout(() => startVoting(nextPendingTicket.id), 400);
                  }
                }}
                disabled={!selectedEstimate}
                className="px-6 py-2.5 font-bold rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm"
                style={{ background: "var(--status-active)", color: "var(--bg-dark)" }}>
                Lock It →
              </button>
            </div>
          </div>
        </div>
      )}

      {currentTicket.status === "complete" && (
        <div className="mt-8 text-center animate-fade-in">
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl"
               style={{ background: "color-mix(in srgb, var(--status-active) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--status-active) 30%, transparent)" }}>
            <span style={{ color: "var(--status-active)" }}>✓</span>
            <span style={{ color: "var(--text-primary)" }}>
              Locked at <strong className="font-mono" style={{ color: "var(--accent)" }}>{currentTicket.final_estimate}</strong>
            </span>
          </div>
          {nextPendingTicket && (
            <div className="mt-6">
              <button onClick={() => startVoting(nextPendingTicket.id)}
                className="px-6 py-3 font-bold rounded-xl hover:shadow-lg transition-all"
                style={{ background: "linear-gradient(to right, var(--btn-primary-from), var(--btn-primary-to))", color: "var(--btn-primary-text)" }}>
                Next: {nextPendingTicket.title}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── TicketDisplay — fetches Jira data from cache, scrollable areas ───
function TicketDisplay({ ticket }: { ticket: any }) {
  const { jiraCache, fetchJiraData } = useStore();
  const [jiraDescription, setJiraDescription] = useState<string | null>(null);
  const [jiraSummary, setJiraSummary] = useState<string | null>(null);
  const [jiraLoading, setJiraLoading] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);

  useEffect(() => {
    if (!ticket.jira_key) return;

    const cached = jiraCache[ticket.jira_key];
    if (cached) {
      setJiraDescription(cached.data.description);
      setJiraSummary(cached.data.summary);
      return;
    }

    setJiraLoading(true);
    fetchJiraData(ticket.jira_key).then(data => {
      if (data) {
        setJiraDescription(data.description);
        setJiraSummary(data.summary);
      }
      setJiraLoading(false);
    });
  }, [ticket.jira_key, jiraCache, fetchJiraData]);

  const badges: Record<string, { label: string; bg: string; text: string }> = {
    pending: { label: "Pending", bg: "var(--badge-pending-bg)", text: "var(--badge-pending-text)" },
    voting: { label: "Voting", bg: "var(--badge-voting-bg)", text: "var(--badge-voting-text)" },
    revealed: { label: "Revealed", bg: "var(--badge-revealed-bg)", text: "var(--badge-revealed-text)" },
    complete: { label: "Complete", bg: "var(--badge-complete-bg)", text: "var(--badge-complete-text)" },
  };
  const b = badges[ticket.status] || badges.pending;

  return (
    <div className="rounded-2xl p-6" style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)" }}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded"
                  style={{ background: b.bg, color: b.text, border: "1px solid color-mix(in srgb, " + b.text + " 30%, transparent)" }}>
              {b.label}
            </span>
            {ticket.jira_key && (
              <a href={ticket.external_url || "#"} target="_blank" rel="noopener noreferrer"
                 className="text-xs font-mono px-2 py-0.5 rounded flex items-center gap-1 transition-all hover:opacity-80"
                 style={{ background: "color-mix(in srgb, var(--accent) 15%, transparent)", color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84c0-.46-.38-.84-.84-.84H11.53zM6.77 6.8c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V7.64c0-.46-.38-.84-.84-.84H6.77zM2 11.6c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V12.44c0-.46-.38-.84-.84-.84H2z"/>
                </svg>
                {ticket.jira_key}
              </a>
            )}
            {ticket.final_estimate && (
              <span className="font-mono text-sm px-2 py-0.5 rounded"
                    style={{ background: "color-mix(in srgb, var(--accent) 20%, transparent)", color: "var(--accent)" }}>
                {ticket.final_estimate} pts
              </span>
            )}
          </div>
          <h2 className="font-display text-2xl" style={{ color: "var(--text-primary)" }}>{ticket.title}</h2>

          {ticket.jira_key && jiraLoading && (
            <p className="mt-2 text-sm animate-pulse" style={{ color: "var(--text-muted)" }}>Loading ticket details from Jira...</p>
          )}

          {/* Poker Summary — scrollable */}
          {jiraSummary && (
            <div className="mt-3 p-3 rounded-xl" style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 15%, transparent)" }}>
              <span className="text-xs font-bold" style={{ color: "var(--accent)" }}>📋 Summary</span>
              <div className="mt-1 max-h-32 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "var(--border-medium) transparent" }}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>{jiraSummary}</p>
              </div>
            </div>
          )}

          {/* Manual ticket description — scrollable */}
          {!ticket.jira_key && ticket.description && (
            <div className="mt-2 max-h-40 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "var(--border-medium) transparent" }}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                {ticket.description}
              </p>
            </div>
          )}

          {/* Full Jira description — expandable and scrollable */}
          {ticket.jira_key && jiraDescription && !jiraLoading && (
            <div className="mt-2">
              <button
                onClick={() => setShowFullDesc(!showFullDesc)}
                className="text-xs transition-all"
                style={{ color: "var(--text-muted)" }}>
                {showFullDesc ? "▲ Hide full description" : "▼ Show full Jira description"}
              </button>
              {showFullDesc && (
                <div className="mt-2 max-h-48 overflow-y-auto p-3 rounded-lg pr-2"
                     style={{ background: "color-mix(in srgb, var(--bg-dark) 50%, transparent)", scrollbarWidth: "thin", scrollbarColor: "var(--border-medium) transparent" }}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-muted)" }}>
                    {jiraDescription}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VoteDistribution({ votes }: { votes: { value: string; displayName: string }[] }) {
  const counts: Record<string, number> = {};
  votes.forEach(v => { counts[v.value] = (counts[v.value] || 0) + 1; });
  const max = Math.max(...Object.values(counts));

  return (
    <div className="flex items-end justify-center gap-3 h-24">
      {Object.entries(counts)
        .sort(([a], [b]) => {
          const na = parseFloat(a), nb = parseFloat(b);
          if (!isNaN(na) && !isNaN(nb)) return na - nb;
          return a.localeCompare(b);
        })
        .map(([value, count]) => (
          <div key={value} className="flex flex-col items-center gap-1">
            <div className="w-12 rounded-t-lg transition-all duration-500"
                 style={{ height: (count / max) * 60 + 16 + "px", background: "linear-gradient(to top, var(--vote-bar-from), var(--vote-bar-to))" }} />
            <span className="font-mono text-sm" style={{ color: "var(--accent)" }}>{value}</span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>x{count}</span>
          </div>
        ))}
    </div>
  );
}
