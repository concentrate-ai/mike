import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth";
import { getUserApiKeys } from "../lib/userSettings";

export const concentrateModelsRouter = Router();

type ConcentrateModel = {
    id: string;
    name: string;
    author: string;
    zdr: boolean;
};

type CacheEntry = {
    models: ConcentrateModel[];
    fetchedAt: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: CacheEntry | null = null;

function apiKey(userKey?: string | null): string {
    return (
        userKey?.trim() ||
        process.env.CONCENTRATE_API_KEY?.trim() ||
        ""
    );
}

async function fetchModelsFromApi(key: string): Promise<ConcentrateModel[]> {
    const res = await fetch("https://api.concentrate.ai/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
            `Concentrate /v1/models failed (${res.status}): ${text || res.statusText}`,
        );
    }
    const json = await res.json();
    const models = Array.isArray(json) ? json : (json as { data?: unknown[] }).data ?? [];
    type RawProvider = { zdr?: false | { policy_url?: string; certificate_url?: string } };
    type RawModel = {
        slug?: string;
        name?: string;
        author?: { slug?: string };
        providers?: Record<string, RawProvider>;
    };
    return (models as RawModel[]).map((m) => ({
        id: m.slug ?? "",
        name: m.name ?? m.slug ?? "",
        author: m.author?.slug ?? "unknown",
        zdr: !!m.providers && typeof m.providers === "object" && Object.values(m.providers).some((p) => !!p.zdr),
    }));
}

concentrateModelsRouter.get(
    "/",
    requireAuth,
    async (_req: Request, res: Response): Promise<void> => {
        try {
            const userId = res.locals.userId as string;
            const apiKeys = await getUserApiKeys(userId);
            const key = apiKey(apiKeys.concentrate);

            if (!key) {
                res.json({ models: [] });
                return;
            }

            if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
                res.json({ models: cache.models });
                return;
            }

            const models = await fetchModelsFromApi(key);
            cache = { models, fetchedAt: Date.now() };
            res.json({ models });
        } catch (err) {
            console.error("[concentrate-models]", err);
            res.json({ models: cache?.models ?? [] });
        }
    },
);
