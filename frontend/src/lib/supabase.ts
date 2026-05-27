import { createClient } from "@supabase/supabase-js";

// Supabase is proxied through a Next.js API route at /api/supabase/*.
// We construct the full URL from window.location.origin at runtime so it
// works with any hostname (local, Cloudflare tunnel, custom domain) without
// needing to update .env.local when the public URL changes.
function resolveSupabaseUrl(): string {
    const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // If it's already an absolute URL (set explicitly in env), use it as-is.
    if (envUrl && (envUrl.startsWith("http://") || envUrl.startsWith("https://"))) {
        return envUrl;
    }
    // At runtime in the browser, build from the current origin.
    if (typeof window !== "undefined") {
        return `${window.location.origin}/api/supabase`;
    }
    // Server-side fallback (used during SSR — Supabase SDK won't make real
    // network calls here since auth is client-only).
    return "http://localhost:4000/api/supabase";
}

const supabaseUrl = resolveSupabaseUrl();
const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
