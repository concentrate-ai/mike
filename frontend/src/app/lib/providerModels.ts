import type { CatalogModel } from "./mikeApi";
import { fetchProviderModels, fetchMergedModels } from "./mikeApi";

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

export async function getMergedModels(): Promise<CatalogModel[]> {
    const CACHE_KEY = "__merged_v2__";
    const cached = cache.get(CACHE_KEY);
    if (cached && Date.now() - cached.fetchedAt < CLIENT_CACHE_TTL_MS) {
        return cached.models;
    }
    try {
        const models = await fetchMergedModels();
        cache.set(CACHE_KEY, { models, fetchedAt: Date.now() });
        return models;
    } catch (err) {
        console.error("[providerModels] merged fetch failed:", err);
        return cache.get(CACHE_KEY)?.models ?? [];
    }
}

export const CATALOG_PROVIDERS: {
    id: string;
    apiKeyProvider: string;
    label: string;
}[] = [
    { id: "concentrate", apiKeyProvider: "concentrate", label: "Concentrate" },
];
