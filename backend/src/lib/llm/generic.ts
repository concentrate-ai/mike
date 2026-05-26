import { makeOpenAIResponsesAdapter } from "./openaiResponses";
import { providerDef, resolveBaseUrl, resolveEnvKey } from "./providers";

const def = providerDef("generic");

const adapter = makeOpenAIResponsesAdapter({
    apiKeysField: "generic",
    label: def.label,
    resolveBaseUrl: () => resolveBaseUrl(def),
    resolveEnvKey: () => resolveEnvKey(def),
});

export const streamGeneric = adapter.stream;
export const completeGenericText = adapter.complete;
