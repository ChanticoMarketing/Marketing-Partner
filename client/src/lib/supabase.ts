import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan variables VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. " +
      "Asegúrate de definirlas en .env"
  );
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
