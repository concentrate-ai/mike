import { Router, type Request, type Response } from "express";
import { requireAuth } from "../../middleware/auth";
import { getUserApiKeys } from "../../lib/userSettings";
import { resolveEnvKey, providerDef } from "../../lib/llm/providers";
import { fetchConcentrateModels } from "./concentrate";
import { fetchAnthropicModels } from "./anthropic";
import { fetchGeminiModels } from "./gemini";
import { fetchOpenAIModels } from "./openai";
import type { CatalogModel } from "./types";

export { CatalogModel };

export const providerModelsRouter = Router();

const VALID_PROVIDERS = new Set(["concentrate", "anthropic", "gemini", "openai"]);

/**
 * Merged catalog: fetch all configured providers in parallel, deduplicate by
 * slug, overlay ZDR status from Concentrate. Frontier providers are the source
 * of truth for model existence; Concentrate is the source of truth for ZDR.
 */
providerModelsRouter.get(
    "/merged/models",
    requireAuth,
    async (_req: Request, res: Response): Promise<void> => {
        try {
            const userId = res.locals.userId as string;
            const userKeys = await getUserApiKeys(userId);

            const concentrateKey =
                userKeys.concentrate?.trim() ||
                resolveEnvKey(providerDef("concentrate")) ||
                "";
            const anthropicKey =
                userKeys.claude?.trim() ||
                resolveEnvKey(providerDef("claude")) ||
                "";
            const geminiKey =
                userKeys.gemini?.trim() ||
                resolveEnvKey(providerDef("gemini")) ||
                "";
            const openaiKey =
                userKeys.openai?.trim() ||
                resolveEnvKey(providerDef("openai")) ||
                "";

            // Fetch all configured providers in parallel — missing keys return []
            const [concentrateModels, anthropicModels, geminiModels, openaiModels] =
                await Promise.all([
                    concentrateKey ? fetchConcentrateModels(concentrateKey).catch(() => []) : Promise.resolve([]),
                    anthropicKey ? fetchAnthropicModels(anthropicKey).catch(() => []) : Promise.resolve([]),
                    geminiKey ? fetchGeminiModels(geminiKey).catch(() => []) : Promise.resolve([]),
                    openaiKey ? fetchOpenAIModels(openaiKey).catch(() => []) : Promise.resolve([]),
                ]);

            // Build ZDR lookup: slug → true (from Concentrate)
            const zdrBySlug = new Map<string, boolean>();
            for (const m of concentrateModels) {
                if (m.zdr) zdrBySlug.set(m.id, true);
            }

            // Build Concentrate capability lookup for enrichment
            const concentrateBySlug = new Map<string, CatalogModel>();
            for (const m of concentrateModels) {
                concentrateBySlug.set(m.id, m);
            }

            // Merge: start with Concentrate as base (richest metadata + pricing),
            // then add any frontier models not already present.
            const merged = new Map<string, CatalogModel>();

            // 1. Seed with Concentrate models (full metadata)
            for (const m of concentrateModels) {
                merged.set(m.id, m);
            }

            // 2. Add frontier models not in Concentrate, overlay ZDR where available
            for (const m of [...anthropicModels, ...geminiModels, ...openaiModels]) {
                if (merged.has(m.id)) {
                    // Already from Concentrate — keep Concentrate's richer data,
                    // but ensure the routing provider is preserved as concentrate
                    continue;
                }
                // Not in Concentrate yet — add with ZDR overlaid if known
                merged.set(m.id, {
                    ...m,
                    zdr: zdrBySlug.get(m.id) ?? false,
                });
            }

            res.json({ models: Array.from(merged.values()) });
        } catch (err) {
            console.error("[providerModels/merged]", err);
            res.json({ models: [] });
        }
    },
);

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
                if (!key) { res.json({ models: [] }); return; }
                models = await fetchConcentrateModels(key);
            } else if (providerId === "anthropic") {
                const key =
                    userKeys.claude?.trim() ||
                    resolveEnvKey(providerDef("claude")) ||
                    "";
                if (!key) { res.json({ models: [] }); return; }
                models = await fetchAnthropicModels(key);
            } else if (providerId === "gemini") {
                const key =
                    userKeys.gemini?.trim() ||
                    resolveEnvKey(providerDef("gemini")) ||
                    "";
                if (!key) { res.json({ models: [] }); return; }
                models = await fetchGeminiModels(key);
            } else if (providerId === "openai") {
                const key =
                    userKeys.openai?.trim() ||
                    resolveEnvKey(providerDef("openai")) ||
                    "";
                if (!key) { res.json({ models: [] }); return; }
                models = await fetchOpenAIModels(key);
            }

            res.json({ models });
        } catch (err) {
            console.error(`[providerModels/${req.params.providerId}]`, err);
            res.json({ models: [] });
        }
    },
);
