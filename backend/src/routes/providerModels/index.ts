import { Router, type Request, type Response } from "express";
import { requireAuth } from "../../middleware/auth";
import { getUserApiKeys } from "../../lib/userSettings";
import { resolveEnvKey, resolveBaseUrl, providerDef } from "../../lib/llm/providers";
import { fetchConcentrateModels } from "./concentrate";
import { fetchAnthropicModels } from "./anthropic";
import { fetchGeminiModels } from "./gemini";
import { fetchOpenAIModels } from "./openai";
import { fetchGenericModels } from "./generic";
import type { CatalogModel } from "./types";

export { CatalogModel };

export const providerModelsRouter = Router();

const VALID_PROVIDERS = new Set(["concentrate", "anthropic", "gemini", "openai", "ollama", "vllm", "generic"]);

// Local providers that are enabled purely by env var (no user API key needed).
// Returns which ones have a base URL configured so the frontend knows which tabs to show.
providerModelsRouter.get("/local-providers", requireAuth, (_req, res) => {
    const providers: { id: string; label: string }[] = [];
    for (const id of ["ollama", "vllm", "generic"] as const) {
        try {
            const def = providerDef(id);
            resolveBaseUrl(def); // throws if not configured
            providers.push({ id, label: def.label });
        } catch {
            // not configured
        }
    }
    res.json({ providers });
});

providerModelsRouter.get(
    "/:providerId/models",
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
        const { providerId } = req.params;
        if (!VALID_PROVIDERS.has(providerId)) {
            res.status(400).json({ detail: `Unknown provider: ${providerId}` });
            return;
        }

        try {
            const userId = res.locals.userId as string;
            const userKeys = await getUserApiKeys(userId);

            let models: CatalogModel[] = [];

            if (providerId === "concentrate") {
                const key =
                    userKeys.concentrate?.trim() ||
                    resolveEnvKey(providerDef("concentrate")) ||
                    "";
                if (!key) {
                    res.json({ models: [] });
                    return;
                }
                models = await fetchConcentrateModels(key);
            } else if (providerId === "anthropic") {
                const key =
                    userKeys.claude?.trim() ||
                    resolveEnvKey(providerDef("claude")) ||
                    "";
                if (!key) {
                    res.json({ models: [] });
                    return;
                }
                models = await fetchAnthropicModels(key);
            } else if (providerId === "gemini") {
                const key =
                    userKeys.gemini?.trim() ||
                    resolveEnvKey(providerDef("gemini")) ||
                    "";
                if (!key) {
                    res.json({ models: [] });
                    return;
                }
                models = await fetchGeminiModels(key);
            } else if (providerId === "openai") {
                const key =
                    userKeys.openai?.trim() ||
                    resolveEnvKey(providerDef("openai")) ||
                    "";
                if (!key) {
                    res.json({ models: [] });
                    return;
                }
                models = await fetchOpenAIModels(key);
            } else if (providerId === "ollama" || providerId === "vllm" || providerId === "generic") {
                const def = providerDef(providerId as "ollama" | "vllm" | "generic");
                let baseUrl: string;
                try {
                    baseUrl = resolveBaseUrl(def);
                } catch {
                    res.json({ models: [] });
                    return;
                }
                const userKey = providerId === "ollama"
                    ? userKeys.ollama
                    : providerId === "vllm"
                        ? userKeys.vllm
                        : userKeys.generic;
                const key = userKey?.trim() || resolveEnvKey(def) || "";
                const rawModels = await fetchGenericModels(baseUrl, key);
                // Tag models with their actual provider id
                models = rawModels.map((m) => ({ ...m, provider: providerId as "ollama" | "vllm" | "generic" }));
            }

            res.json({ models });
        } catch (err) {
            console.error(`[providerModels/${req.params.providerId}]`, err);
            res.json({ models: [] });
        }
    },
);
