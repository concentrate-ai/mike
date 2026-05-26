import { makeOpenAIResponsesAdapter } from "./openaiResponses";
import { providerDef, resolveBaseUrl, resolveEnvKey } from "./providers";

const def = providerDef("vllm");

const adapter = makeOpenAIResponsesAdapter({
    apiKeysField: "vllm",
    label: def.label,
    resolveBaseUrl: () => resolveBaseUrl(def),
    resolveEnvKey: () => resolveEnvKey(def),
});

export const streamVllm = adapter.stream;
export const completeVllmText = adapter.complete;
