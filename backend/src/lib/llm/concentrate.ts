import { makeOpenAIResponsesAdapter } from "./openaiResponses";
import { providerDef, resolveBaseUrl, resolveEnvKey } from "./providers";

const def = providerDef("concentrate");

const adapter = makeOpenAIResponsesAdapter({
    apiKeysField: "concentrate",
    label: def.label,
    resolveBaseUrl: () => resolveBaseUrl(def),
    resolveEnvKey: () => resolveEnvKey(def),
});

export const streamConcentrate = adapter.stream;
export const completeConcentrateText = adapter.complete;
