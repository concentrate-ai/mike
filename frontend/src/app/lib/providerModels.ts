import type { CatalogModel } from "./mikeApi";
import { fetchProviderModels, fetchLocalProviders } from "./mikeApi";

export type { CatalogModel };

type ProviderCacheEntry = {
    models: CatalogModel[];
    fetchedAt: number;
};

const CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, ProviderCacheEntry>();

export function clearProviderModelsCache(providerId?: string): void {
    if (providerId) {
        cache.delete(providerId);
    } else {
        cache.clear();
    }
}

export type ProviderModelsResult =
    | { ok: true; models: CatalogModel[] }
    | { ok: false; error: string };

export async function getProviderModels(providerId: string): Promise<CatalogModel[]> {
    const cached = cache.get(providerId);
    if (cached && Date.now() - cached.fetchedAt < CLIENT_CACHE_TTL_MS) {
        return cached.models;
    }
    try {
        const models = await fetchProviderModels(providerId);
        cache.set(providerId, { models, fetchedAt: Date.now() });
        return models;
    } catch (err) {
        console.error(`[providerModels] fetch failed for ${providerId}:`, err);
        return cache.get(providerId)?.models ?? [];
    }
}

/** Map a backend provider id to a human-readable tab label. */
export function providerTabLabel(providerId: string): string {
    const labels: Record<string, string> = {
        concentrate: "Concentrate",
        anthropic: "Anthropic",
        gemini: "Google",
        openai: "OpenAI",
        ollama: "Ollama",
        vllm: "vLLM",
        generic: "Custom",
    };
    return labels[providerId] ?? providerId;
}

/** Which backend endpoint ids correspond to which user api key provider ids. */
export const CATALOG_PROVIDERS: {
    id: string;
    apiKeyProvider: string;
    label: string;
}[] = [
    { id: "concentrate", apiKeyProvider: "concentrate", label: "Concentrate" },
    { id: "anthropic", apiKeyProvider: "claude", label: "Anthropic" },
    { id: "gemini", apiKeyProvider: "gemini", label: "Google" },
    { id: "openai", apiKeyProvider: "openai", label: "OpenAI" },
    // Ollama, vLLM, and Custom are added dynamically from /providers/local-providers
    // when the server has them configured.
];

// Cache for local provider tabs (Ollama, vLLM, Custom)
let localProvidersCache: { id: string; label: string }[] | null = null;

export async function getLocalProviders(): Promise<{ id: string; label: string }[]> {
    if (localProvidersCache !== null) return localProvidersCache;
    try {
        const providers = await fetchLocalProviders();
        localProvidersCache = providers;
        return localProvidersCache;
    } catch {
        return [];
    }
}
