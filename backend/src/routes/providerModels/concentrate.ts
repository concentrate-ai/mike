import type { CatalogModel } from "./types";

type RawProvider = {
    zdr?: false | { policy_url?: string; certificate_url?: string };
    context_window?: number;
    max_output_tokens?: number;
    supports?: {
        tools?: { function_calling?: boolean };
        input?: {
            image?: boolean | { png?: boolean; jpg?: boolean };
            file?: { pdf?: boolean };
            text?: boolean;
        };
        stream?: boolean;
        reasoning?: boolean;
        text?: { format?: boolean };
        output?: { text?: { format?: boolean } };
    };
    pricing?: {
        tokens?: {
            input?: { price?: { USD?: number } };
            output?: { price?: { USD?: number } };
        };
    };
};

type RawModel = {
    slug?: string;
    name?: string;
    description?: string;
    author?: { slug?: string; display_name?: string };
    providers?: Record<string, RawProvider>;
    context_length?: number;
    max_tokens?: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { models: CatalogModel[]; fetchedAt: number } | null = null;

export async function fetchConcentrateModels(apiKey: string): Promise<CatalogModel[]> {
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
        return cache.models;
    }

    const res = await fetch("https://api.concentrate.ai/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Concentrate /v1/models failed (${res.status}): ${text || res.statusText}`);
    }
    const json = await res.json();
    const raw: RawModel[] = Array.isArray(json) ? json : ((json as { data?: unknown[] }).data ?? []);

    // Authors to exclude entirely — low-quality or irrelevant for general use
    const BLOCKED_AUTHORS = new Set([
        "amazon",    // Nova models
        "ibm",       // Granite
        "nvidia",    // Nemotron
        "stepfunai", // Step AI
        "writer",    // Palmyra
        "xiaomi",    // MiMo
        "ai21",      // Jamba
    ]);

    // Individual slugs to exclude within otherwise-kept authors
    const BLOCKED_SLUGS = new Set([
        // OpenAI: internal/eval models already covered by native OpenAI tab
        "gpt-oss-120b", "gpt-oss-20b", "gpt-oss-safeguard-120b", "gpt-oss-safeguard-20b",
        "gpt-5.3-codex", "gpt-5.2-codex", "gpt-5.1-codex-max", "gpt-5.1-codex-mini",
        // Anthropic: stale generations
        "claude-opus-4-1", "claude-opus-4", "claude-sonnet-4",
        // DeepSeek: superseded versions
        "deepseek-r1", "deepseek-r1-distill-32b", "deepseek-v3-0324", "deepseek-v3-1",
        // Alibaba: near-dupes and vision-only
        "qwen3-30b", "qwen3-coder-30b-a3b", "qwen3-next-80b-a3b", "qwen3-vl-235b-a22b",
        // Meta: old small models and dupe
        "llama-4-scout-17b-16e-instruct",
        "llama-3.2-3b-instruct", "llama-3.2-1b-instruct", "llama-3.1-8b-instruct",
        "llama-3.2-11b-instruct", "llama-3-70b-instruct", "llama-3-8b-instruct",
        // Mistral: superseded versions
        "mistral-medium-3", "mistral-nemo", "mistral-small-3.1",
        "ministral-3-3b", "ministral-3-8b",
        // MiniMax: older/redundant versions
        "minimax-m2", "minimax-m2-1", "minimax-m2-1-highspeed", "minimax-m2-5-highspeed",
        // Moonshot: thinking dupe of k2-6
        "kimi-k2-thinking",
        // xAI: dated snapshots and fast/non-reasoning variants
        "grok-4.20-multi-agent-0309", "grok-4.20-0309-reasoning", "grok-4.20-0309-non-reasoning",
        "grok-4-0709", "grok-4-fast-reasoning", "grok-4-fast-non-reasoning",
        "grok-4-1-fast-reasoning", "grok-4-1-fast-non-reasoning", "grok-code-fast-1",
        // GLM: stale versions
        "glm-4.5", "glm-4.6", "glm-4.5v", "glm-4.6v", "glm-4.7-flash",
        // Google (in Concentrate): old Gemma 3
        "gemma-3-12b", "gemma-3-4b", "gemma-3-27b",
        // Cohere: vision dupe
        "command-a-vision",
    ]);

    // Display order for vendor groups in the catalog
    const VENDOR_ORDER: Record<string, number> = {
        anthropic: 1, openai: 2, google: 3, xai: 4,
        deepseek: 5, mistral: 6, meta: 7, alibaba: 8,
        moonshot: 9, minimax: 10, zai: 11, cohere: 12,
    };

    // Human-readable group labels
    const VENDOR_LABELS: Record<string, string> = {
        anthropic: "Anthropic",
        openai: "OpenAI",
        google: "Google",
        xai: "xAI",
        deepseek: "DeepSeek",
        mistral: "Mistral",
        meta: "Meta",
        alibaba: "Alibaba",
        moonshot: "Moonshot",
        minimax: "MiniMax",
        zai: "Zhipu AI",
        cohere: "Cohere",
    };

    const slugAuthor = new Map(raw.map((m) => [m.slug ?? "", m.author?.slug ?? ""]));

    const models: CatalogModel[] = raw
        .filter((m) => {
            const author = m.author?.slug ?? "";
            if (BLOCKED_AUTHORS.has(author)) return false;
            if (BLOCKED_SLUGS.has(m.slug ?? "")) return false;
            return true;
        })
        .map((m) => {
        const providerValues = m.providers ? Object.values(m.providers) : [];
        const firstProv = providerValues[0] as RawProvider | undefined;
        const hasZdr = providerValues.some((p) => !!(p as RawProvider).zdr);

        const inputPrice = providerValues.reduce<number | null>((best, p) => {
            const price = (p as RawProvider).pricing?.tokens?.input?.price?.USD ?? null;
            if (price === null) return best;
            return best === null || price < best ? price : best;
        }, null);
        const outputPrice = providerValues.reduce<number | null>((best, p) => {
            const price = (p as RawProvider).pricing?.tokens?.output?.price?.USD ?? null;
            if (price === null) return best;
            return best === null || price < best ? price : best;
        }, null);

        const supportsImage = firstProv?.supports?.input?.image;
        const authorSlug = m.author?.slug ?? "";
        return {
            provider: "concentrate" as const,
            id: m.slug ?? "",
            display_name: m.name ?? m.slug ?? "",
            description: m.description,
            vendor_group: VENDOR_LABELS[authorSlug] ?? m.author?.display_name ?? authorSlug,
            context_window: firstProv?.context_window,
            max_output_tokens: firstProv?.max_output_tokens,
            supports_tools: firstProv?.supports?.tools?.function_calling,
            supports_streaming: firstProv?.supports?.stream,
            supports_images: supportsImage != null
                ? (typeof supportsImage === "boolean" ? supportsImage : true)
                : undefined,
            supports_pdf: firstProv?.supports?.input?.file?.pdf,
            supports_reasoning: firstProv?.supports?.reasoning,
            supports_json_output:
                firstProv?.supports?.output?.text?.format ??
                firstProv?.supports?.text?.format,
            zdr: hasZdr,
            input_price_per_m: inputPrice,
            output_price_per_m: outputPrice,
        };
    })
    .sort((a, b) => {
        const aOrd = VENDOR_ORDER[slugAuthor.get(a.id) ?? ""] ?? 99;
        const bOrd = VENDOR_ORDER[slugAuthor.get(b.id) ?? ""] ?? 99;
        return aOrd - bOrd;
    });

    cache = { models, fetchedAt: Date.now() };
    return models;
}
