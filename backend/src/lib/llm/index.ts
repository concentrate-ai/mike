import { streamClaude, completeClaudeText } from "./claude";
import { streamGemini, completeGeminiText } from "./gemini";
import { streamOpenAI, completeOpenAIText } from "./openai";
import { streamConcentrate, completeConcentrateText } from "./concentrate";
import { providerForModel } from "./models";
import { hasAnyKey } from "./providers";
import type { StreamChatParams, StreamChatResult, UserApiKeys } from "./types";

export * from "./types";
export * from "./models";

// Route a chat request to a provider adapter. Fallback policy: if the
// model's native provider has no key configured (env or per-user) but
// Concentrate does, route through Concentrate. This lets a single
// Concentrate key cover Claude/Gemini/OpenAI requests without configuring
// every native provider separately.
export async function streamChatWithTools(
    params: StreamChatParams,
): Promise<StreamChatResult> {
    const provider = providerForModel(params.model);
    if (provider === "concentrate") return streamConcentrate(params);
    if (
        !hasAnyKey(provider, params.apiKeys) &&
        hasAnyKey("concentrate", params.apiKeys)
    ) {
        return streamConcentrate(params);
    }
    if (provider === "claude") return streamClaude(params);
    if (provider === "openai") return streamOpenAI(params);
    return streamGemini(params);
}

export async function completeText(params: {
    model: string;
    systemPrompt?: string;
    user: string;
    maxTokens?: number;
    apiKeys?: UserApiKeys;
}): Promise<string> {
    const provider = providerForModel(params.model);
    if (provider === "concentrate") return completeConcentrateText(params);
    if (
        !hasAnyKey(provider, params.apiKeys) &&
        hasAnyKey("concentrate", params.apiKeys)
    ) {
        return completeConcentrateText(params);
    }
    if (provider === "claude") return completeClaudeText(params);
    if (provider === "openai") return completeOpenAIText(params);
    return completeGeminiText(params);
}
