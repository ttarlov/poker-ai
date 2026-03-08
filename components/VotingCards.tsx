"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";

const CARDS = [
  { value: "0.5", display: "0.5" },
  { value: "1", display: "1" },
  { value: "2", display: "2" },
  { value: "3", display: "3" },
  { value: "4", display: "4" },
  { value: "5", display: "5" },
  { value: "?", display: "?" },
  { value: "☕", display: "☕" },
];

export default function VotingCards({ ticketId }: { ticketId: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const { castVote, gameState, myParticipantId } = useStore();

  // Reset selected when ticket changes (new round)
  useEffect(() => {
    setSelected(null);
  }, [ticketId]);

  // Check if we already voted (e.g. on page reload)
  const myVote = (gameState.votes[ticketId] || []).find(v => v.participant_id === myParticipantId);
  const effectiveSelected = selected || myVote?.value || null;

  const handleVote = async (value: string) => {
    setSelected(value);
    await castVote(ticketId, value);
  };

  return (
    <div className="sticky bottom-0 pt-8 pb-5 px-4 backdrop-blur-sm"
         style={{ background: "linear-gradient(to top, var(--bg), color-mix(in srgb, var(--bg) 80%, transparent), transparent)" }}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end justify-center gap-2 sm:gap-3">
          {CARDS.map((card) => {
            const isSelected = effectiveSelected === card.value;
            return (
              <button key={card.value} onClick={() => handleVote(card.value)}
                className="relative group w-12 sm:w-14 md:w-16 h-[72px] sm:h-20 md:h-24
                           rounded-xl border-2 flex items-center justify-center transition-all duration-200"
                style={{
                  background: isSelected ? "var(--accent)" : "var(--card-face)",
                  borderColor: isSelected ? "var(--accent-light)" : "color-mix(in srgb, var(--card-face) 60%, transparent)",
                  transform: isSelected ? "translateY(-12px) scale(1.05)" : "none",
                  boxShadow: isSelected ? "0 8px 32px color-mix(in srgb, var(--accent) 40%, transparent)" : "none",
                  cursor: "pointer",
                }}
                onMouseEnter={e => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLElement).style.transform = "translateY(-8px)";
                    (e.currentTarget as HTMLElement).style.borderColor = "color-mix(in srgb, var(--accent) 40%, transparent)";
                  }
                }}
                onMouseLeave={e => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLElement).style.transform = "none";
                    (e.currentTarget as HTMLElement).style.borderColor = "color-mix(in srgb, var(--card-face) 60%, transparent)";
                  }
                }}>
                <span className="font-display text-xl sm:text-2xl font-bold"
                      style={{ color: isSelected ? "var(--text-on-accent)" : "var(--card-text)" }}>
                  {card.display}
                </span>
                {!isSelected && (
                  <>
                    <span className="absolute top-1 left-1.5 text-[8px] font-mono"
                          style={{ color: "color-mix(in srgb, var(--card-text) 30%, transparent)" }}>{card.display}</span>
                    <span className="absolute bottom-1 right-1.5 text-[8px] font-mono rotate-180"
                          style={{ color: "color-mix(in srgb, var(--card-text) 30%, transparent)" }}>{card.display}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        <div className="text-center mt-3 text-sm animate-fade-in"
             style={{ color: effectiveSelected ? "color-mix(in srgb, var(--accent) 60%, transparent)" : "var(--text-muted)" }}>
          {effectiveSelected
            ? <>You voted <strong style={{ color: "var(--accent)" }}>{effectiveSelected}</strong> — tap another card to change</>
            : "Pick a card to cast your vote"}
        </div>
      </div>
    </div>
  );
}
