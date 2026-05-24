import type { CatalogModel } from "./types";

type RawModel = {
    name?: string;
    displayName?: string;
    description?: string;
    inputTokenLimit?: number;
    outputTokenLimit?: number;
    supportedGenerationMethods?: string[];
    thinking?: boolean;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { models: CatalogModel[]; fetchedAt: number } | null = null;

export async function fetchGeminiModels(apiKey: string): Promise<CatalogModel[]> {
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
        return cache.models;
    }

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    );
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Gemini /v1beta/models failed (${res.status}): ${text || res.statusText}`);
    }
    const json = await res.json();
    const raw: RawModel[] = Array.isArray(json)
        ? json
        : ((json as { models?: unknown[] }).models ?? []);

    // Patterns that identify non-chat models (TTS, image gen, robotics, audio, research agents, etc.)
    const NON_CHAT_PATTERNS = [
        /tts/i,
        /image/i,
        /robotics/i,
        /lyria/i,
        /banana/i,
        /computer.use/i,
        /antigravity/i,
        /deep.research/i,
        /embedding/i,
        /aqa/i,
    ];

    // Dated/pinned suffixes like -001, -002; also internal variants
    const DATED_SUFFIX = /-\d{3}$/;
    const INTERNAL_PATTERNS = [/customtools/i, /-latest$/i];

    const allIds = new Set(
        raw.map((m) => (m.name ?? "").replace(/^models\//, "")).filter(Boolean),
    );

    function hasDatedAlias(id: string): boolean {
        const base = id.replace(DATED_SUFFIX, "");
        return base !== id && allIds.has(base);
    }

    const models: CatalogModel[] = raw
        .filter((m) => {
            const methods = m.supportedGenerationMethods ?? [];
            if (!methods.includes("generateContent")) return false;
            const id = (m.name ?? "").replace(/^models\//, "");
            const label = m.displayName ?? id;
            if (NON_CHAT_PATTERNS.some((re) => re.test(id) || re.test(label))) return false;
            if (INTERNAL_PATTERNS.some((re) => re.test(id))) return false;
            if (hasDatedAlias(id)) return false;
            return true;
        })
        .map((m) => {
            // "models/gemini-1.5-flash-001" → "gemini-1.5-flash-001"
            const id = (m.name ?? "").replace(/^models\//, "");
            return {
                provider: "gemini" as const,
                id,
                display_name: m.displayName ?? id,
                description: m.description,
                context_window: m.inputTokenLimit,
                max_output_tokens: m.outputTokenLimit,
                supports_reasoning: m.thinking,
            };
        });

    cache = { models, fetchedAt: Date.now() };
    return models;
}
