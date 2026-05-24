import type { CatalogModel } from "./types";

type RawModel = {
    id?: string;
    object?: string;
    owned_by?: string;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { models: CatalogModel[]; fetchedAt: number } | null = null;

export async function fetchOpenAIModels(apiKey: string): Promise<CatalogModel[]> {
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
        return cache.models;
    }

    const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`OpenAI /v1/models failed (${res.status}): ${text || res.statusText}`);
    }
    const json = await res.json();
    const raw: RawModel[] = Array.isArray(json)
        ? json
        : ((json as { data?: unknown[] }).data ?? []);

    // Exclude non-chat model types by ID substring
    const NON_CHAT_PATTERNS = [
        /image/i,
        /audio/i,
        /tts/i,
        /transcribe/i,
        /realtime/i,
        /search/i,
        /deep.research/i,
        /instruct/i,
        /safeguard/i,
        /embedding/i,
        /whisper/i,
        /translate/i,
    ];

    // Legacy models not worth showing
    const LEGACY_IDS = new Set([
        "gpt-3.5-turbo", "gpt-3.5-turbo-16k", "gpt-3.5-turbo-1106",
        "gpt-3.5-turbo-0125", "gpt-3.5-turbo-instruct", "gpt-3.5-turbo-instruct-0914",
        "gpt-4-0613", "gpt-4",
    ]);

    // Dated variants: gpt-4o-2024-05-13, o3-2025-04-16, gpt-5.4-2026-03-05
    const DATED_SUFFIX = /(-\d{4}-\d{2}-\d{2})$/;
    // "-chat-latest" and "-pro-latest" style redirects are duplicates of the base slug
    const ALIAS_SUFFIX = /-chat-latest$|-pro-latest$/;

    const allIds = new Set(raw.map((m) => m.id).filter(Boolean) as string[]);

    function hasDatedAlias(id: string): boolean {
        const base = id.replace(DATED_SUFFIX, "");
        return base !== id && allIds.has(base);
    }

    function displayName(id: string): string {
        // GPT-4o → "GPT 4o", o3-mini → "o3 mini", gpt-5.4-pro → "GPT 5.4 Pro"
        return id
            .replace(/^gpt-/, "GPT ")
            .replace(/^(o\d)/, (m) => m.toUpperCase() + " ")
            .replace(/-/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .replace(/\b\w/g, (c) => c.toUpperCase())
            // Fix "GPT 4O" back to "GPT 4o" — lowercase 'o' suffix after digit
            .replace(/(\d)O\b/g, "$1o");
    }

    const models: CatalogModel[] = raw
        .filter((m) => {
            if (!m.id) return false;
            if (!/^(gpt-|o1|o3|o4)/.test(m.id)) return false;
            if (LEGACY_IDS.has(m.id)) return false;
            if (NON_CHAT_PATTERNS.some((re) => re.test(m.id!))) return false;
            if (hasDatedAlias(m.id)) return false;
            if (ALIAS_SUFFIX.test(m.id)) return false;
            return true;
        })
        .map((m) => ({
            provider: "openai" as const,
            id: m.id!,
            display_name: displayName(m.id!),
        }));

    cache = { models, fetchedAt: Date.now() };
    return models;
}
