import { providerDef, hasAnyKey } from "./providers";
import {
    CLAUDE_LOW_MODELS,
    CLAUDE_MAIN_MODELS,
    GEMINI_LOW_MODELS,
    GEMINI_MAIN_MODELS,
    OPENAI_LOW_MODELS,
    OPENAI_MAIN_MODELS,
    DEFAULT_MAIN_MODEL,
    DEFAULT_TABULAR_MODEL,
    DEFAULT_TITLE_MODEL,
    providerForModel,
} from "./models";
import type { Provider, UserApiKeys } from "./types";

/**
 * Split a provider-qualified id ("anthropic:claude-opus-4-7") into its parts.
 * Unqualified ids (legacy bare slugs) fall back to providerForModel().
 */
export function parseQualifiedId(id: string): { provider: Provider; slug: string } {
    const colon = id.indexOf(":");
    if (colon === -1) {
        return { provider: providerForModel(id), slug: id };
    }
    return { provider: id.slice(0, colon) as Provider, slug: id.slice(colon + 1) };
}

/**
 * Build a provider-qualified id from a provider and a bare slug.
 * e.g. qualify("claude", "claude-opus-4-7") → "claude:claude-opus-4-7"
 */
export function qualifiedId(provider: Provider, slug: string): string {
    return `${provider}:${slug}`;
}

/** Infer tier from a model slug for auto-tier-on-first-enable. */
export function inferTier(modelId: string): "high" | "medium" | "low" | null {
    const slug = parseQualifiedId(modelId).slug;
    if (/claude-opus/i.test(slug)) return "high";
    if (/claude-sonnet/i.test(slug)) return "medium";
    if (/claude-haiku/i.test(slug)) return "low";
    if (/gemini.*-pro/i.test(slug)) return "high";
    if (/gemini.*-flash$|gemini.*-flash-preview/i.test(slug)) return "medium";
    if (/gemini.*flash-lite/i.test(slug)) return "low";
    if (/gpt-5\.5|gpt-4o\b|o3$|o4/i.test(slug)) return "high";
    if (/gpt.*-mini\b/i.test(slug)) return "medium";
    if (/gpt.*-nano\b/i.test(slug)) return "low";
    if (/opus|pro\b|large|max/i.test(slug)) return "high";
    if (/lite|nano|mini|haiku|flash/i.test(slug)) return "low";
    return "medium";
}

type TierName = "high" | "medium" | "low";

/** Return the best default model for a tier given which keys are configured. */
export function defaultModelForTier(tier: TierName, apiKeys?: UserApiKeys): string {
    if (tier === "high") {
        if (hasAnyKey("claude", apiKeys)) return CLAUDE_MAIN_MODELS[0];
        if (hasAnyKey("gemini", apiKeys)) return GEMINI_MAIN_MODELS[0];
        if (hasAnyKey("openai", apiKeys)) return OPENAI_MAIN_MODELS[0];
        if (hasAnyKey("concentrate", apiKeys)) return CLAUDE_MAIN_MODELS[0];
        return DEFAULT_MAIN_MODEL;
    }
    if (tier === "medium") {
        if (hasAnyKey("concentrate", apiKeys)) return DEFAULT_TABULAR_MODEL;
        if (hasAnyKey("gemini", apiKeys)) return DEFAULT_TABULAR_MODEL;
        if (hasAnyKey("openai", apiKeys)) return OPENAI_MAIN_MODELS[1];
        if (hasAnyKey("claude", apiKeys)) return CLAUDE_MAIN_MODELS[1];
        return DEFAULT_TABULAR_MODEL;
    }
    // low
    if (hasAnyKey("concentrate", apiKeys)) return DEFAULT_TITLE_MODEL;
    if (hasAnyKey("gemini", apiKeys)) return DEFAULT_TITLE_MODEL;
    if (hasAnyKey("openai", apiKeys)) return OPENAI_LOW_MODELS[0];
    if (hasAnyKey("claude", apiKeys)) return CLAUDE_LOW_MODELS[0];
    return DEFAULT_TITLE_MODEL;
}

type ProfileTierFields = {
    high_model?: string | null;
    medium_model?: string | null;
    low_model?: string | null;
};

/**
 * Resolve a tier name to a concrete model slug.
 * Uses the user's stored preference if set, otherwise falls back to
 * defaultModelForTier() which picks the cheapest available provider.
 */
export function resolveTier(
    tier: TierName,
    profile: ProfileTierFields,
    apiKeys?: UserApiKeys,
): string {
    const fromUser =
        tier === "high"
            ? profile.high_model
            : tier === "medium"
              ? profile.medium_model
              : profile.low_model;
    if (fromUser) return fromUser;
    return defaultModelForTier(tier, apiKeys);
}

/**
 * Check that the provider named in a qualified id has a key configured.
 * Throws with a user-readable message if the key is missing.
 */
export function assertAdapterKey(qualifiedModelId: string, apiKeys?: UserApiKeys): void {
    const { provider } = parseQualifiedId(qualifiedModelId);
    if (!hasAnyKey(provider, apiKeys)) {
        const def = providerDef(provider);
        throw new Error(`${def.label} key not configured`);
    }
}

/**
 * Resolve the model to use for a tabular review row.
 * The stored value may be a tier name ("high"|"medium"|"low") or a
 * provider-qualified slug. Returns a bare slug ready for routing.
 */
export function resolveReviewModel(
    storedModel: string | null | undefined,
    profile: ProfileTierFields,
    apiKeys?: UserApiKeys,
): string {
    if (!storedModel) return resolveTier("medium", profile, apiKeys);
    if (storedModel === "high" || storedModel === "medium" || storedModel === "low") {
        return resolveTier(storedModel, profile, apiKeys);
    }
    // Provider-qualified or bare slug — strip qualifier for routing layer
    return parseQualifiedId(storedModel).slug;
}
