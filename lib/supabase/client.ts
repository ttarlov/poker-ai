import { createBrowserClient } from "@supabase/ssr";
import { createMockClient } from "../mock-supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const isLocalMock = supabaseUrl === "http://localhost:mock";

export function createClient() {
  if (isLocalMock) return createMockClient() as any;
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
