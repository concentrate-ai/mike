import { streamClaude, completeClaudeText } from "./claude";
import { streamGemini, completeGeminiText } from "./gemini";
import { streamOpenAI, completeOpenAIText } from "./openai";
import { streamConcentrate, completeConcentrateText } from "./concentrate";
import { streamOllama, completeOllamaText } from "./ollama";
import { streamVllm, completeVllmText } from "./vllm";
import { streamGeneric, completeGenericText } from "./generic";
import { providerForModel } from "./models";
import { hasAnyKey } from "./providers";
import { parseQualifiedId } from "./routing";
import type { Provider, StreamChatParams, StreamChatResult, UserApiKeys } from "./types";

export * from "./types";
export * from "./models";

/**
 * Resolve a (possibly qualified) model id to {provider, slug}.
 *
 * Routing priority:
 *   1. If Concentrate key is available → always prefer Concentrate.
 *      It handles every provider behind the scenes; routing direct is only
 *      useful when the user explicitly has that provider's own key AND no
 *      Concentrate key.
 *   2. If the id is provider-qualified (e.g. "claude:claude-opus-4-7") and
 *      the named provider has a key, use it directly.
 *   3. Fall back to inferring provider from the bare slug.
 */
// These providers are always local — Concentrate cannot route to them.
const LOCAL_PROVIDERS = new Set<Provider>(["ollama", "vllm", "generic"]);

function pick(
    model: string,
    apiKeys: UserApiKeys | undefined,
): { provider: Provider; slug: string } {
    const { provider: explicit, slug } = parseQualifiedId(model);

    // Local providers (Ollama, vLLM, Custom) always route direct — Concentrate
    // cannot reach them since they're not in its model registry.
    if (explicit && LOCAL_PROVIDERS.has(explicit)) {
        return { provider: explicit, slug };
    }

    // Concentrate is configured → always route through it.
    if (hasAnyKey("concentrate", apiKeys)) {
        return { provider: "concentrate", slug };
    }

    // No Concentrate key — use whatever native key the user has.
    // If the id was qualified, honour the explicit provider.
    if (explicit !== "concentrate" && hasAnyKey(explicit, apiKeys)) {
        return { provider: explicit, slug };
    }

    // Infer from slug shape as last resort.
    const inferred = providerForModel(slug);
    return { provider: inferred, slug };
}

export async function streamChatWithTools(
    params: StreamChatParams,
): Promise<StreamChatResult> {
    const { provider, slug } = pick(params.model, params.apiKeys);
    const p = { ...params, model: slug };
    if (provider === "concentrate") return streamConcentrate(p);
    if (provider === "claude")      return streamClaude(p);
    if (provider === "openai")      return streamOpenAI(p);
    if (provider === "ollama")      return streamOllama(p);
    if (provider === "vllm")        return streamVllm(p);
    if (provider === "generic")     return streamGeneric(p);
    return streamGemini(p);
}

export async function completeText(params: {
    model: string;
    systemPrompt?: string;
    user: string;
    maxTokens?: number;
    apiKeys?: UserApiKeys;
}): Promise<string> {
    const { provider, slug } = pick(params.model, params.apiKeys);
    const p = { ...params, model: slug };
    if (provider === "concentrate") return completeConcentrateText(p);
    if (provider === "claude")      return completeClaudeText(p);
    if (provider === "openai")      return completeOpenAIText(p);
    if (provider === "ollama")      return completeOllamaText(p);
    if (provider === "vllm")        return completeVllmText(p);
    if (provider === "generic")     return completeGenericText(p);
    return completeGeminiText(p);
}
