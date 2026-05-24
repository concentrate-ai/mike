/**
 * Provider registry.
 *
 * One source of truth for which providers Mike speaks. Each entry describes:
 *   - id            — UserApiKeys field name + DB enum value
 *   - label         — human-facing name in errors and UI
 *   - envKey        — env var to read for the server-wide API key fallback
 *   - adapterType   — which SDK/protocol family this provider uses
 *   - modelIdPrefixes — for inferring a provider from a bare model id
 *   - resolveBaseUrl — optional base-URL override (env-driven)
 *
 * Adding a new OpenAI-Responses-compatible provider (OpenRouter, LiteLLM in
 * Responses mode, vLLM, Ollama OpenAI shim, etc.) is two steps:
 *   1. Extend the Provider union in types.ts with the new id.
 *   2. Add an entry below with adapterType: "openai-responses" and the
 *      provider's baseUrl + env var name. The DB user_api_keys CHECK
 *      constraint also needs the new value via a migration.
 *
 * The llm/index.ts router and userApiKeys.ts both consult this registry, so
 * no other code changes are needed for routing or for env-key resolution.
 */
import type { Provider, UserApiKeys } from "./types";

export type AdapterType = "claude-sdk" | "gemini-sdk" | "openai-responses";

export interface ProviderDef {
    id: Provider;
    label: string;
    envKey: string;
    /** Optional env var that overrides the provider's base URL. */
    envBaseUrl?: string;
    /** Default base URL when envBaseUrl is unset or empty. */
    defaultBaseUrl?: string;
    adapterType: AdapterType;
    /**
     * Model id prefixes used by providerForModel(id) when the caller hands us
     * a bare model id without knowing the provider. The first matching prefix
     * wins. Leave empty for providers that should never be inferred (catch-
     * alls like Concentrate).
     */
    modelIdPrefixes: string[];
}

export const PROVIDERS: readonly ProviderDef[] = [
    {
        id: "claude",
        label: "Anthropic (Claude)",
        envKey: "ANTHROPIC_API_KEY",
        adapterType: "claude-sdk",
        modelIdPrefixes: ["claude"],
    },
    {
        id: "gemini",
        label: "Google (Gemini)",
        envKey: "GEMINI_API_KEY",
        adapterType: "gemini-sdk",
        modelIdPrefixes: ["gemini"],
    },
    {
        id: "openai",
        label: "OpenAI",
        envKey: "OPENAI_API_KEY",
        envBaseUrl: "OPENAI_RESPONSES_URL",
        defaultBaseUrl: "https://api.openai.com/v1/responses",
        adapterType: "openai-responses",
        modelIdPrefixes: ["gpt-", "o1", "o3", "o4"],
    },
    {
        id: "concentrate",
        label: "Concentrate",
        envKey: "CONCENTRATE_API_KEY",
        envBaseUrl: "CONCENTRATE_RESPONSES_URL",
        defaultBaseUrl: "https://api.concentrate.ai/v1/responses",
        adapterType: "openai-responses",
        // Concentrate is the catch-all: a bare model id with no known prefix
        // falls through to it. Leaving prefixes empty here keeps that behavior.
        modelIdPrefixes: [],
    },
    {
        id: "generic",
        label: "Custom Endpoint",
        envKey: "GENERIC_API_KEY",
        envBaseUrl: "GENERIC_BASE_URL",
        adapterType: "openai-responses",
        // User-configured base URL + key. Covers LiteLLM, Ollama OpenAI shim,
        // vLLM, TGI, and any other OpenAI-Responses-compatible endpoint.
        // No modelIdPrefixes — models are identified by the user's own slugs.
        modelIdPrefixes: [],
    },
];

const BY_ID = new Map<Provider, ProviderDef>(PROVIDERS.map((p) => [p.id, p]));

export function providerDef(id: Provider): ProviderDef {
    const def = BY_ID.get(id);
    if (!def) throw new Error(`Unknown provider id: ${id}`);
    return def;
}

export function providerLabel(id: Provider): string {
    return providerDef(id).label;
}

/**
 * Resolve the base URL for a Responses-API provider. Env override (if defined
 * for this provider) wins; otherwise the registry default; otherwise the
 * caller is using a provider that has no base URL (claude-sdk / gemini-sdk).
 */
export function resolveBaseUrl(def: ProviderDef): string {
    if (def.envBaseUrl) {
        const fromEnv = process.env[def.envBaseUrl]?.trim();
        if (fromEnv) return fromEnv;
    }
    if (def.defaultBaseUrl) return def.defaultBaseUrl;
    throw new Error(
        `Provider ${def.id} has no base URL configured (adapterType=${def.adapterType})`,
    );
}

export function resolveEnvKey(def: ProviderDef): string | undefined {
    return process.env[def.envKey]?.trim() || undefined;
}

export function hasEnvKey(id: Provider): boolean {
    return !!resolveEnvKey(providerDef(id));
}

export function hasAnyKey(id: Provider, userKeys?: UserApiKeys): boolean {
    return !!(userKeys?.[id]?.trim() || hasEnvKey(id));
}
