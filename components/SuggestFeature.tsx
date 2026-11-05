"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ROOMS_URL } from "@/lib/store";

// "Suggest a feature" — a small header button that opens a form. Submissions go to
// the room Worker's /feedback route, which forwards them to the maintainer's inbox.

type Kind = "feature" | "change" | "bug";
const KINDS: { value: Kind; label: string }[] = [
  { value: "feature", label: "New feature" },
  { value: "change", label: "Change" },
  { value: "bug", label: "Bug" },
];
const MAX_MESSAGE = 2000;

const inputStyle: React.CSSProperties = {
  background: "var(--input-bg)",
  border: "1px solid var(--input-border)",
  color: "var(--text-primary)",
};

export default function SuggestFeature() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full transition-all hover:opacity-100 focus:outline-none focus-visible:ring-2"
        style={{ color: "var(--text-muted)", border: "1px solid var(--border-subtle)", opacity: 0.85 }}
        aria-label="Suggest a feature or change"
        title="Suggest a feature or change"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M12 2a7 7 0 0 0-4 12.74V16h8v-1.26A7 7 0 0 0 12 2Z" />
        </svg>
        <span className="hidden sm:inline">Suggest</span>
      </button>
      {/* Portal to <body>: the header's backdrop-filter would otherwise trap position:fixed. */}
      {open && createPortal(<SuggestDialog onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function SuggestDialog({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<Kind>("feature");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot, hidden from people
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const openedAt = useRef(Date.now());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || status === "sending") return;
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch(ROOMS_URL + "/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, message, email, website, t: openedAt.current }),
      });
      if (res.ok) {
        setStatus("sent");
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't send that. Try again shortly.");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    }
    setStatus("idle");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="suggest-title">
      <div className="absolute inset-0 backdrop-blur-sm" style={{ background: "var(--overlay-bg)" }} onClick={onClose} />
      <div className="relative w-full max-w-md rounded-sm shadow-lg animate-slide-up overflow-y-auto max-h-[90vh]"
           style={{ background: "var(--bg)", border: "1px solid var(--border-medium)" }}>
        <div className="p-6">
          {status === "sent" ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-3">💡</div>
              <h2 id="suggest-title" className="font-display text-xl mb-2" style={{ color: "var(--text-primary)" }}>Thanks, got it</h2>
              <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
                Your suggestion went straight to the person who builds AgilePoker.
                {email.trim() ? " If there's a question, you'll hear back by email." : ""}
              </p>
              <button type="button" onClick={onClose}
                className="px-6 py-2.5 rounded-full text-sm transition-all"
                style={{ color: "var(--text-secondary)", border: "1px solid var(--border-medium)" }}>
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <h2 id="suggest-title" className="font-display text-xl mb-1" style={{ color: "var(--text-primary)" }}>Suggest a feature</h2>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Something missing, annoying, or broken? Tell me.</p>
              </div>

              <div className="flex gap-2" role="radiogroup" aria-label="Type of suggestion">
                {KINDS.map(k => {
                  const active = kind === k.value;
                  return (
                    <button key={k.value} type="button" role="radio" aria-checked={active}
                      onClick={() => setKind(k.value)}
                      className="flex-1 py-2 rounded-full text-sm transition-all"
                      style={active
                        ? { background: "color-mix(in srgb, var(--accent) 15%, transparent)", color: "var(--accent)", border: "1px solid var(--accent)" }
                        : { color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
                      {k.label}
                    </button>
                  );
                })}
              </div>

              <div>
                <label htmlFor="suggest-message" className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  {kind === "bug" ? "What went wrong?" : "Your idea"}
                </label>
                <textarea id="suggest-message" value={message} onChange={e => setMessage(e.target.value)}
                  maxLength={MAX_MESSAGE} rows={5} autoFocus required
                  placeholder={kind === "bug" ? "What you did, what you expected, what happened instead" : "e.g. A countdown timer before cards are revealed"}
                  className="w-full px-4 py-3 rounded-sm resize-none transition-all focus:outline-none"
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = "var(--input-focus-border)"; }}
                  onBlur={e => { e.target.style.borderColor = "var(--input-border)"; }} />
                <p className="text-xs mt-1 text-right font-mono" style={{ color: "var(--text-muted)" }}>{message.length}/{MAX_MESSAGE}</p>
              </div>

              <div>
                <label htmlFor="suggest-email" className="block text-sm mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Email <span style={{ color: "var(--text-muted)" }}>(optional, only if you want a reply)</span>
                </label>
                <input id="suggest-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  maxLength={200} autoComplete="email" placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-full transition-all focus:outline-none"
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = "var(--input-focus-border)"; }}
                  onBlur={e => { e.target.style.borderColor = "var(--input-border)"; }} />
              </div>

              {/* Honeypot: hidden from people and screen readers; bots fill it in. */}
              <input type="text" name="website" value={website} onChange={e => setWebsite(e.target.value)}
                tabIndex={-1} autoComplete="off" aria-hidden="true"
                style={{ position: "absolute", left: "-10000px", width: 1, height: 1, opacity: 0 }} />

              {error && <p className="text-sm" role="alert" style={{ color: "var(--red-suit, #ef4444)" }}>{error}</p>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={onClose}
                  className="flex-1 py-3 rounded-full transition-all"
                  style={{ color: "var(--text-secondary)", border: "1px solid var(--border-medium)" }}>Cancel</button>
                <button type="submit" disabled={!message.trim() || status === "sending"}
                  className="flex-1 py-3 font-bold rounded-full hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  style={{ background: "linear-gradient(to right, var(--btn-primary-from), var(--btn-primary-to))", color: "var(--btn-primary-text)" }}>
                  {status === "sending" ? "Sending..." : "Send"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
