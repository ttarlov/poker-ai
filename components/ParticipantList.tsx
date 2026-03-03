"use client";

interface Participant {
  id: string;
  participant_id: string;
  display_name: string;
}

const AVATAR_COLORS = [
  "#60a5fa", "#fb7185", "#fbbf24", "#a78bfa",
  "#22d3ee", "#f472b6", "#a3e635", "#fb923c",
];

export default function ParticipantList({ participants }: { participants: Participant[] }) {
  return (
    <div className="flex items-center gap-1">
      {participants.map((p, i) => (
        <div key={p.id} className="group relative">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                       ring-2 ring-black/20 -ml-1 first:ml-0 transition-transform hover:scale-110 hover:z-10"
            style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length], color: "#1a1a2e" }}
          >
            {p.display_name.charAt(0).toUpperCase()}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2"
               style={{ background: "var(--status-active)", boxShadow: "0 0 4px var(--status-active)" }} />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1
                          bg-gray-900 text-white text-xs rounded whitespace-nowrap
                          opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20">
            {p.display_name}
          </div>
        </div>
      ))}
      {participants.length === 0 && (
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>Waiting for players...</span>
      )}
    </div>
  );
}
