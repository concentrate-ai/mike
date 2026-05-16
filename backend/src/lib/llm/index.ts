import { streamClaude, completeClaudeText } from "./claude";
import { streamGemini, completeGeminiText } from "./gemini";
import { streamOpenAI, completeOpenAIText } from "./openai";
import { streamConcentrate, completeConcentrateText } from "./concentrate";
import { providerForModel } from "./models";
import type { StreamChatParams, StreamChatResult, UserApiKeys } from "./types";

export * from "./types";
export * from "./models";

function hasNativeKey(provider: string, keys?: UserApiKeys): boolean {
    if (provider === "claude") return !!(keys?.claude?.trim() || process.env.ANTHROPIC_API_KEY);
    if (provider === "openai") return !!(keys?.openai?.trim() || process.env.OPENAI_API_KEY);
    if (provider === "gemini") return !!(keys?.gemini?.trim() || process.env.GEMINI_API_KEY);
    return false;
}

function hasConcentrateKey(keys?: UserApiKeys): boolean {
    return !!(keys?.concentrate?.trim() || process.env.CONCENTRATE_API_KEY);
}

export async function streamChatWithTools(
    params: StreamChatParams,
): Promise<StreamChatResult> {
    const provider = providerForModel(params.model);
    if (provider === "concentrate") return streamConcentrate(params);
    if (!hasNativeKey(provider, params.apiKeys) && hasConcentrateKey(params.apiKeys)) {
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
    if (provider === "concentrate")
        return completeConcentrateText(params);
    if (!hasNativeKey(provider, params.apiKeys) && hasConcentrateKey(params.apiKeys)) {
        return completeConcentrateText(params);
    }
    if (provider === "claude") return completeClaudeText(params);
    if (provider === "openai") return completeOpenAIText(params);
    return completeGeminiText(params);
}
