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

const FLAGSHIP_IDS = new Set([
    "claude-opus-4-7",
    "claude-sonnet-4-6",
    "claude-opus-4-5",
    "claude-sonnet-4-5",
    "claude-opus-4-1",
    "claude-haiku-4-5",
    "gpt-5.5",
    "gpt-5.4-mini",
    "gpt-5.4",
    "gpt-5.4-nano",
    "o1",
    "gemini-3.1-pro-preview",
    "gemini-3-flash-preview",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "deepseek-r1",
    "deepseek-v3-2",
    "deepseek-v4-pro",
    "llama-4-maverick",
    "llama-4-scout",
    "minimax-m2-7",
    "mistral-large-3",
    "magistral-medium-1.2",
    "qwen3-30b",
    "qwq-32b",
    "grok-4",
    "grok-3",
    "kimi-k2-5",
]);

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
        const models: ModelOption[] = json.models
            .filter((m) => m.id && FLAGSHIP_IDS.has(m.id))
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
