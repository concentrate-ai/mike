import { makeOpenAIResponsesAdapter } from "./openaiResponses";
import { providerDef, resolveBaseUrl, resolveEnvKey } from "./providers";

const def = providerDef("ollama");

const adapter = makeOpenAIResponsesAdapter({
    apiKeysField: "ollama",
    label: def.label,
    resolveBaseUrl: () => resolveBaseUrl(def),
    resolveEnvKey: () => resolveEnvKey(def),
    keyOptional: true,
});

export const streamOllama = adapter.stream;
export const completeOllamaText = adapter.complete;
