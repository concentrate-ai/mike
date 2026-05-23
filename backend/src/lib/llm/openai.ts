import { makeOpenAIResponsesAdapter } from "./openaiResponses";
import { providerDef, resolveBaseUrl, resolveEnvKey } from "./providers";

const def = providerDef("openai");

const adapter = makeOpenAIResponsesAdapter({
    apiKeysField: "openai",
    label: def.label,
    resolveBaseUrl: () => resolveBaseUrl(def),
    resolveEnvKey: () => resolveEnvKey(def),
});

export const streamOpenAI = adapter.stream;
export const completeOpenAIText = adapter.complete;
