import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/middleware";

const isLocalMock = process.env.NEXT_PUBLIC_SUPABASE_URL === "http://localhost:mock";

export async function middleware(request: NextRequest) {
  // In mock mode, skip all auth logic
  if (isLocalMock) {
    return NextResponse.next();
  }

  const { supabase, response } = createClient(request);

  // Refresh session tokens for authenticated users (no-op if not signed in)
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
