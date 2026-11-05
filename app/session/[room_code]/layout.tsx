import type { Metadata } from "next";

// Rooms are private and short-lived: keep them out of search results and give
// shared room links a plain preview.
export const metadata: Metadata = {
  title: "Planning session",
  description: "Join this AgilePoker planning poker room. No sign-up needed.",
  robots: { index: false, follow: false },
  alternates: { canonical: null },
  openGraph: {
    title: "Join my planning poker room · AgilePoker",
    description: "Free planning poker for agile teams. Click to join; no sign-up needed.",
  },
};

export default function SessionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
