import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { ThemeProvider } from "@/lib/theme-provider";
import { AuthProvider } from "@/lib/auth-provider";
import PageAnalytics from "@/components/PageAnalytics";

const DESCRIPTION =
  "Free online planning poker (scrum poker) for agile teams. Create a room, share the link, and vote on story points in real time. Votes stay hidden until reveal. No sign-up.";

export const metadata: Metadata = {
  metadataBase: new URL("https://agilepoker.dev"),
  title: {
    default: "AgilePoker — Free Planning Poker for Agile Teams",
    template: "%s · AgilePoker",
  },
  description: DESCRIPTION,
  applicationName: "AgilePoker",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "AgilePoker",
    title: "AgilePoker — Free Planning Poker for Agile Teams",
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "AgilePoker — Free Planning Poker for Agile Teams",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#F8F2E9",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="felt-bg min-h-screen">
        <ThemeProvider>
          <AuthProvider>
            <StoreProvider>{children}</StoreProvider>
          </AuthProvider>
        </ThemeProvider>
        <PageAnalytics />
      </body>
    </html>
  );
}
