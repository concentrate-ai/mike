import type { CatalogModel } from "./types";

type RawModel = {
    id?: string;
    object?: string;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { models: CatalogModel[]; fetchedAt: number } | null = null;

/**
 * Fetch models from a user-configured OpenAI-compatible endpoint.
 * Covers LiteLLM, Ollama (OpenAI shim), vLLM, TGI, and any other provider
 * that speaks the OpenAI /v1/models shape.
 */
export async function fetchGenericModels(
    baseUrl: string,
    apiKey: string,
): Promise<CatalogModel[]> {
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
        return cache.models;
    }

    // Strip a trailing Responses-API path if the user supplied the full
    // responses endpoint URL — we need the /v1/models sibling.
    const modelsUrl = baseUrl.replace(/\/responses$/, "") + "/models";

    const headers: Record<string, string> = { Accept: "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const res = await fetch(modelsUrl, { headers });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Generic /v1/models failed (${res.status}): ${text || res.statusText}`);
    }
    const json = await res.json();
    const raw: RawModel[] = Array.isArray(json)
        ? json
        : ((json as { data?: unknown[] }).data ?? []);

    const models: CatalogModel[] = raw
        .filter((m) => m.id)
        .map((m) => ({
            provider: "generic" as const,
            id: m.id!,
            display_name: m.id!,
        }));

    cache = { models, fetchedAt: Date.now() };
    return models;
}

export function invalidateGenericCache(): void {
    cache = null;
}
