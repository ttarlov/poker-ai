import { createClient } from "@supabase/supabase-js";
import { createMockClient } from "./mock-supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const isLocalMock = supabaseUrl === "http://localhost:mock";

export const supabase: any = isLocalMock
  ? createMockClient()
  : createClient(supabaseUrl, supabaseAnonKey);
