"use client";

import { useEffect } from "react";

// Full-screen celebration shown to every participant when the table reaches
// unanimous consensus on an estimate. The screen goes black, then a nuclear
// mushroom cloud fades in. Total runtime is ~4s, after which onDone unmounts it.
export default function NuclearConsensus({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 5000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center animate-nuke-overlay"
      style={{ background: "#000", pointerEvents: "none" }}
    >
      <div className="animate-mushroom-in">
        <MushroomCloud />
        <p
          className="mt-4 text-center font-display tracking-[0.3em] uppercase text-sm"
          style={{ color: "#ff7b29", textShadow: "0 0 14px rgba(255,123,41,0.8)" }}
        >
          Consensus
        </p>
      </div>
    </div>
  );
}

function MushroomCloud() {
  return (
    <svg
      width="460"
      height="575"
      viewBox="0 0 400 500"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: "drop-shadow(0 0 40px rgba(255,123,41,0.45))" }}
    >
      <defs>
        <radialGradient id="nukeSmoke" cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#9a948c" />
          <stop offset="55%" stopColor="#5b554f" />
          <stop offset="100%" stopColor="#2a2622" />
        </radialGradient>
        <radialGradient id="nukeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff3b0" />
          <stop offset="35%" stopColor="#ff9f1c" />
          <stop offset="70%" stopColor="#ff5400" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#ff5400" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="nukeStem" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6b655d" />
          <stop offset="60%" stopColor="#4a443d" />
          <stop offset="100%" stopColor="#ff7b29" />
        </linearGradient>
      </defs>

      {/* Ground fireball glow */}
      <ellipse cx="200" cy="450" rx="150" ry="55" fill="url(#nukeGlow)" />

      {/* Rising stem */}
      <path
        d="M168 200 C150 290 144 370 134 448 L266 448 C256 370 250 290 232 200 Z"
        fill="url(#nukeStem)"
      />

      {/* Billowing cap — overlapping smoke blobs */}
      <g fill="url(#nukeSmoke)">
        <circle cx="200" cy="120" r="95" />
        <circle cx="120" cy="150" r="62" />
        <circle cx="280" cy="150" r="62" />
        <circle cx="155" cy="95" r="58" />
        <circle cx="245" cy="95" r="58" />
        <circle cx="200" cy="80" r="64" />
        <circle cx="95" cy="170" r="40" />
        <circle cx="305" cy="170" r="40" />
      </g>

      {/* Inner heat in the cap */}
      <circle cx="200" cy="135" r="48" fill="url(#nukeGlow)" opacity="0.55" />
    </svg>
  );
}
