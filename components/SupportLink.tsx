"use client";

// "Buy me a coffee" tip link. Payment happens entirely on buymeacoffee.com;
// this app never sees card details. Hidden when no URL is configured.
export const BUY_ME_A_COFFEE_URL =
  process.env.NEXT_PUBLIC_BUY_ME_A_COFFEE_URL || "";

export default function SupportLink() {
  if (!BUY_ME_A_COFFEE_URL) return null;

  return (
    <a
      href={BUY_ME_A_COFFEE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
                 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md
                 focus:outline-none focus-visible:ring-2"
      style={{
        background: "var(--input-bg)",
        color: "var(--text-secondary)",
        border: "1px solid var(--border-subtle)",
      }}
      aria-label="Support AgilePoker: buy me a $5 coffee (opens buymeacoffee.com in a new tab)"
    >
      <svg
        className="w-4 h-4 transition-transform duration-200 group-hover:-rotate-12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ color: "var(--accent)" }}
      >
        <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
        <line x1="6" y1="2" x2="6" y2="4" />
        <line x1="10" y1="2" x2="10" y2="4" />
        <line x1="14" y1="2" x2="14" y2="4" />
      </svg>
      <span>
        Enjoying it? <span style={{ color: "var(--accent)" }}>Buy me a coffee</span>
        <span style={{ color: "var(--text-muted)" }}> · $5</span>
      </span>
    </a>
  );
}
