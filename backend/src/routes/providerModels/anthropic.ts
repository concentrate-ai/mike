import type { CatalogModel } from "./types";

type RawCapabilities = {
    batch?: { supported?: boolean };
    citations?: { supported?: boolean };
    code_execution?: { supported?: boolean };
    effort?: { supported?: boolean };
    image_input?: { supported?: boolean };
    pdf_input?: { supported?: boolean };
    structured_outputs?: { supported?: boolean };
    thinking?: { supported?: boolean };
    tool_use?: { supported?: boolean };
    streaming?: { supported?: boolean };
};

type RawModel = {
    id?: string;
    display_name?: string;
    capabilities?: RawCapabilities;
    max_input_tokens?: number;
    max_tokens?: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { models: CatalogModel[]; fetchedAt: number } | null = null;

export async function fetchAnthropicModels(apiKey: string): Promise<CatalogModel[]> {
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
        return cache.models;
    }

    const res = await fetch("https://api.anthropic.com/v1/models", {
        headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
        },
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Anthropic /v1/models failed (${res.status}): ${text || res.statusText}`);
    }
    const json = await res.json();
    const raw: RawModel[] = Array.isArray(json) ? json : ((json as { data?: unknown[] }).data ?? []);

    // Dated variants like claude-opus-4-5-20251101 are redundant when a clean
    // alias (claude-opus-4-5) also exists in the list.
    const DATED_SUFFIX = /(-\d{8})$/;
    const allIds = new Set(raw.map((m) => m.id).filter(Boolean) as string[]);

    function hasDatedAlias(id: string): boolean {
        const base = id.replace(DATED_SUFFIX, "");
        return base !== id && allIds.has(base);
    }

    const models: CatalogModel[] = raw
        .filter((m) => m.id && !hasDatedAlias(m.id))
        .map((m) => ({
            provider: "claude" as const,
            id: m.id!,
            display_name: m.display_name ?? m.id!,
            context_window: m.max_input_tokens,
            max_output_tokens: m.max_tokens,
            supports_tools: m.capabilities?.tool_use?.supported,
            supports_streaming: m.capabilities?.streaming?.supported,
            supports_images: m.capabilities?.image_input?.supported,
            supports_pdf: m.capabilities?.pdf_input?.supported,
            supports_reasoning: m.capabilities?.thinking?.supported,
            supports_json_output: m.capabilities?.structured_outputs?.supported,
        }));

    cache = { models, fetchedAt: Date.now() };
    return models;
}
