import { createServerSupabase } from "./supabase";
import {
    resolveModel,
    DEFAULT_TITLE_MODEL,
    DEFAULT_TABULAR_MODEL,
    OPENAI_LOW_MODELS,
    type UserApiKeys,
} from "./llm";
import { resolveTier } from "./llm/routing";
import { getUserApiKeys as getStoredUserApiKeys } from "./userApiKeys";

export type UserModelSettings = {
    title_model: string;
    tabular_model: string;
    api_keys: UserApiKeys;
};

type ProfileTierFields = {
    high_model?: string | null;
    medium_model?: string | null;
    low_model?: string | null;
};

// Title generation is a lightweight task — always routed to the cheapest model
// of whichever provider the user has keys for.
function resolveTitleModel(apiKeys: UserApiKeys): string {
    if (apiKeys.concentrate?.trim()) return DEFAULT_TITLE_MODEL;
    if (apiKeys.gemini?.trim()) return DEFAULT_TITLE_MODEL;
    if (apiKeys.openai?.trim()) return OPENAI_LOW_MODELS[0];
    if (apiKeys.claude?.trim()) return "claude-haiku-4-5";
    return DEFAULT_TITLE_MODEL;
}

export async function getUserModelSettings(
    userId: string,
    db?: ReturnType<typeof createServerSupabase>,
): Promise<UserModelSettings> {
    const client = db ?? createServerSupabase();
    const { data } = await client
        .from("user_profiles")
        .select("tabular_model, high_model, medium_model, low_model")
        .eq("user_id", userId)
        .single();
    const api_keys = await getStoredUserApiKeys(userId, client);

    const tierFields: ProfileTierFields = {
        high_model: data?.high_model,
        medium_model: data?.medium_model,
        low_model: data?.low_model,
    };

    // tabular_model (legacy column) is the fallback when neither per-review
    // model nor medium_model is set. We still read it for backward compat.
    const legacyTabular = resolveModel(data?.tabular_model, DEFAULT_TABULAR_MODEL);
    const mediumResolved = resolveTier("medium", tierFields, api_keys);

    return {
        title_model: resolveTitleModel(api_keys),
        // Use the user's stored medium preference if set, else the legacy column
        tabular_model: tierFields.medium_model ? mediumResolved : legacyTabular,
        api_keys,
    };
}

export async function getUserApiKeys(
    userId: string,
    db?: ReturnType<typeof createServerSupabase>,
): Promise<UserApiKeys> {
    const client = db ?? createServerSupabase();
    return getStoredUserApiKeys(userId, client);
}
