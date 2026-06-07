import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // Build vaqtda env var bo'lmasa ham crash qilmasin
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://placeholder.supabase.co";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "placeholder-key-for-build";
  return createBrowserClient(url, key);
}
