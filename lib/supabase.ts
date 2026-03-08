// Compatibility shim — re-exports a singleton browser client so existing
// `import { supabase } from "@/lib/supabase"` references continue to work.
import { createClient } from "./supabase/client";

export const supabase: any = createClient();
