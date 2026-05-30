import type { ApiKeyState } from "@/app/lib/mikeApi";
import type { ModelOption } from "./models";

type ConcentrateModel = {
    id: string;
    name: string;
    author: string;
    zdr: boolean;
};

const AUTHOR_DISPLAY: Record<string, string> = {
    anthropic: "Anthropic",
    google: "Google",
    openai: "OpenAI",
    alibaba: "Alibaba",
    deepseek: "DeepSeek",
    meta: "Meta",
    minimax: "MiniMax",
    mistral: "Mistral",
    moonshot: "Moonshot",
    xai: "xAI",
};

function displayAuthor(slug: string): string {
    return AUTHOR_DISPLAY[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1);
}

let cachedModels: ModelOption[] | null = null;
let cacheKey: string | null = null;

export function clearConcentrateModelsCache(): void {
    cachedModels = null;
    cacheKey = null;
}

const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export async function fetchConcentrateModels(
    apiKeys: ApiKeyState,
): Promise<ModelOption[]> {
    if (!apiKeys.concentrate?.configured) return [];

    const key = "concentrate-models";
    if (cachedModels && cacheKey === key) return cachedModels;

    try {
        const { supabase } = await import("@/lib/supabase");
        const {
            data: { session },
        } = await supabase.auth.getSession();
        const headers: Record<string, string> = {
            Accept: "application/json",
        };
        if (session?.access_token) {
            headers.Authorization = `Bearer ${session.access_token}`;
        }

        const res = await fetch(`${API_BASE}/concentrate/models`, { headers });
        if (!res.ok) return [];

        const json = (await res.json()) as { models: ConcentrateModel[] };
        // API is the source of truth — backend already filters to ZDR-only
        const models: ModelOption[] = json.models
            .filter((m) => m.id)
            .map((m) => ({
                id: m.id,
                label: m.name || m.id,
                group: displayAuthor(m.author),
                zdr: m.zdr,
            }));

        cachedModels = models;
        cacheKey = key;
        return models;
    } catch {
        return cachedModels ?? [];
    }
}
