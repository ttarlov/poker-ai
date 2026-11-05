"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

// Vercel Web Analytics: cookieless page-view counts. A room code is the key to a
// room, so it never leaves the browser: session URLs are reported as
// /session/[code], and query strings (?redirect=/session/...) and hashes are dropped.
export function redactUrl(raw: string): string {
  const url = new URL(raw);
  url.pathname = url.pathname.replace(/^\/session\/[^/]+/, "/session/[code]");
  url.search = "";
  url.hash = "";
  return url.toString();
}

export default function PageAnalytics() {
  return (
    <Analytics
      beforeSend={(event: BeforeSendEvent) => ({ ...event, url: redactUrl(event.url) })}
    />
  );
}
