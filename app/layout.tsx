import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { ThemeProvider } from "@/lib/theme-provider";
import { AuthProvider } from "@/lib/auth-provider";

export const metadata: Metadata = {
  title: "AgilePoker — Planning Poker for Dev Teams",
  description: "Free real-time planning poker for agile teams. No sign-up; rooms expire after 24 hours.",
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
      </body>
    </html>
  );
}
