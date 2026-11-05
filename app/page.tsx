import { Suspense } from "react";
import HomeActions from "@/components/HomeActions";
import SupportLink from "@/components/SupportLink";
import { LIMITS } from "@/shared/room-protocol";

// Server-rendered so search engines and link previews see real content; only the
// name / create / join controls hydrate on the client.

const STEPS = [
  { title: "Create a room", text: "Type your name and open a room. No account, no download." },
  { title: "Share the link", text: "Send the room link or its 8-character code to your team." },
  { title: "Vote and reveal", text: "Everyone picks a card in secret. Reveal together, discuss, lock the estimate." },
];

const FAQ = [
  {
    q: "Is AgilePoker free?",
    a: "Yes. There are no paid plans and no ads. A tip jar helps cover hosting.",
  },
  {
    q: "Do people need an account?",
    a: "No. Each person enters a display name and joins with the room link or code.",
  },
  {
    q: "Can teammates see my vote before the reveal?",
    a: "No. The server keeps every vote hidden until someone reveals the cards, so nobody anchors on the first number.",
  },
  {
    q: "How many people can join a room?",
    a: `Up to ${LIMITS.participants} people per room.`,
  },
  {
    q: "What happens to a room afterwards?",
    a: "Rooms are deleted automatically after 24 hours without activity. Room codes are random and rooms can't be browsed or listed.",
  },
  {
    q: "Which cards are in the deck?",
    a: "0.5, 1, 2, 3, 4 and 5 story points, plus ? for unsure and ☕ for a break.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "AgilePoker",
  url: "https://agilepoker.dev",
  description:
    "Free real-time planning poker for agile teams. Create a room, share the link, and vote on story points with votes hidden until reveal. No sign-up.",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Any (web browser)",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md">
          <header className="text-center mb-10">
            <div className="inline-flex items-center gap-3 mb-4" aria-hidden="true">
              <div className="flex gap-1.5">
                <span className="text-3xl">♠</span>
                <span className="text-3xl" style={{ color: "var(--red-suit)" }}>♥</span>
                <span className="text-3xl">♣</span>
                <span className="text-3xl" style={{ color: "var(--red-suit)" }}>♦</span>
              </div>
            </div>
            <h1 className="font-display text-5xl tracking-tight mb-2" style={{ color: "var(--text-primary)" }}>
              Agile<span style={{ color: "var(--accent)" }}>Poker</span>
            </h1>
            <p className="text-sm tracking-widest uppercase" style={{ color: "var(--text-secondary)" }}>
              Free Planning Poker for Agile Teams
            </p>
          </header>

          <Suspense fallback={
            <div className="text-center py-8">
              <div className="text-3xl mb-3 animate-pulse-soft">🃏</div>
              <p style={{ color: "var(--text-muted)" }}>Loading...</p>
            </div>
          }>
            <HomeActions />
          </Suspense>

          <div className="text-center mt-10">
            <span className="inline-block px-3 py-1 text-[10px] tracking-widest uppercase rounded-full"
                  style={{ color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}>
              Free · No sign-up · Rooms expire after 24h
            </span>
            <div className="mt-4">
              <SupportLink />
            </div>
          </div>
        </div>

        <a href="#about" className="mt-10 mb-6 text-xs tracking-widest uppercase transition-opacity hover:opacity-70"
           style={{ color: "var(--text-muted)" }}>
          How it works ↓
        </a>
      </div>

      <section id="about" className="px-4 pb-20" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="max-w-3xl mx-auto pt-16">
          <h2 className="font-display text-3xl mb-4 text-center" style={{ color: "var(--text-primary)" }}>
            Planning poker without the setup
          </h2>
          <p className="text-center max-w-xl mx-auto mb-12 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            AgilePoker is a free online planning poker tool (also called scrum poker or pointing poker) for
            estimating user stories with your team in real time. Open a room, share the link, and vote on story
            points from any browser.
          </p>

          <ol className="grid gap-4 sm:grid-cols-3 mb-16">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-sm p-5"
                  style={{ background: "var(--input-bg)", border: "1px solid var(--border-subtle)" }}>
                <span className="font-mono text-xs" style={{ color: "var(--accent)" }}>0{i + 1}</span>
                <h3 className="font-display text-lg mt-1 mb-1.5" style={{ color: "var(--text-primary)" }}>{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{s.text}</p>
              </li>
            ))}
          </ol>

          <h2 className="font-display text-2xl mb-6 text-center" style={{ color: "var(--text-primary)" }}>
            Questions
          </h2>
          <dl className="space-y-5 max-w-xl mx-auto">
            {FAQ.map(f => (
              <div key={f.q}>
                <dt className="font-medium mb-1" style={{ color: "var(--text-primary)" }}>{f.q}</dt>
                <dd className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
