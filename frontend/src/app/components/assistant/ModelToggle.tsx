"use client";

import { useMemo, useState, useEffect } from "react";
import { ChevronDown, Check, AlertCircle, Star, Shield } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ApiKeyState } from "@/app/lib/mikeApi";
import type { CatalogModel } from "@/app/lib/providerModels";
import { getProviderModels, CATALOG_PROVIDERS } from "@/app/lib/providerModels";
import type { ModelOption } from "@/app/lib/models";
import { MODELS } from "@/app/lib/models";

// Re-export for callers that still import from here
export { MODELS, type ModelOption } from "@/app/lib/models";
export { DEFAULT_MODEL_ID, ALLOWED_MODEL_IDS } from "@/app/lib/models";

// Maps routing provider → display author. Concentrate models are grouped by
// their actual model author so the routing layer stays invisible in the UI.
const PROVIDER_LABELS: Record<string, string> = {
    claude: "Anthropic",
    gemini: "Google",
    openai: "OpenAI",
};

// Infer a human-readable author group from a model label or slug.
// Used for Concentrate models that carry their own author from the API.
function authorFromLabel(label: string): string {
    const l = label.toLowerCase();
    if (l.includes("claude")) return "Anthropic";
    if (l.includes("gemini") || l.includes("gemma")) return "Google";
    if (l.includes("gpt") || l.includes("o1") || l.includes("o3") || l.includes("o4")) return "OpenAI";
    if (l.includes("deepseek")) return "DeepSeek";
    if (l.includes("llama")) return "Meta";
    if (l.includes("mistral") || l.includes("magistral")) return "Mistral";
    if (l.includes("grok")) return "xAI";
    if (l.includes("qwen") || l.includes("qwq")) return "Alibaba";
    if (l.includes("kimi")) return "Moonshot";
    if (l.includes("minimax")) return "MiniMax";
    return "Other";
}

function qualifiedIdToOption(qid: string): ModelOption | null {
    const colon = qid.indexOf(":");
    if (colon === -1) {
        return MODELS.find((m) => m.id === qid) ?? null;
    }
    const provider = qid.slice(0, colon);
    const slug = qid.slice(colon + 1);
    const known = MODELS.find((m) => m.id === slug);
    // Group by model author, not routing provider
    const group = known?.group ?? PROVIDER_LABELS[provider] ?? authorFromLabel(slug);
    return {
        id: qid,
        label: known?.label ?? slug,
        group,
        zdr: known?.zdr,
    };
}

/**
 * Build the model list for the assistant dropdown from the user's enabled_models.
 * Falls back to the hardcoded MODELS list if enabledModels is empty (new user
 * before they visit the catalog, or legacy session).
 */
export function useModels(
    enabledModels?: string[],
    favoriteModels?: string[],
    catalogDetails?: CatalogModel[],
): {
    models: ModelOption[];
    dynamicIds: Set<string>;
} {
    // Pull catalog data from the client-side cache (populated when /account/models
    // is visited, or proactively below). This state updates when the cache fills.
    const [cachedDetails, setCachedDetails] = useState<CatalogModel[]>(catalogDetails ?? []);

    useEffect(() => {
        if (catalogDetails && catalogDetails.length > 0) {
            setCachedDetails(catalogDetails);
            return;
        }
        // Proactively fetch all provider catalogs to populate ZDR etc.
        Promise.all(CATALOG_PROVIDERS.map((p) => getProviderModels(p.id)))
            .then((results) => setCachedDetails(results.flat()))
            .catch(() => {});
    }, [catalogDetails]);

    return useMemo(() => {
        const source = enabledModels && enabledModels.length > 0 ? enabledModels : null;

        if (!source) {
            return {
                models: MODELS,
                dynamicIds: new Set(MODELS.map((m) => m.id)),
            };
        }

        // Build a slug→catalog lookup for ZDR and display_name enrichment
        const catalogBySlug = new Map<string, CatalogModel>();
        for (const m of cachedDetails) {
            catalogBySlug.set(m.id, m);
            catalogBySlug.set(`${m.provider}:${m.id}`, m);
        }

        const models = source
            .map((qid) => {
                const opt = qualifiedIdToOption(qid);
                if (!opt) return null;
                const slug = qid.includes(":") ? qid.split(":")[1] : qid;
                const cat = catalogBySlug.get(qid) ?? catalogBySlug.get(slug ?? "");
                if (cat) {
                    const enrichedLabel = cat.display_name || opt.label;
                    return {
                        ...opt,
                        label: enrichedLabel,
                        group: opt.group === "Other" ? authorFromLabel(enrichedLabel) : opt.group,
                        zdr: cat.zdr ?? opt.zdr,
                    };
                }
                return opt;
            })
            .filter((m): m is ModelOption => m !== null);

        return {
            models,
            dynamicIds: new Set(models.map((m) => m.id)),
        };
    }, [enabledModels, cachedDetails]);
}

interface Props {
    value: string;
    onChange: (id: string) => void;
    apiKeys?: ApiKeyState;
    models?: ModelOption[];
    favoriteModels?: string[];
    onToggleFavorite?: (modelId: string) => void;
    showZdr?: boolean;
}

export function ModelToggle({
    value,
    onChange,
    apiKeys,
    models,
    favoriteModels = [],
    onToggleFavorite,
    showZdr = true,
}: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const items = models ?? MODELS;
    const selected = items.find((m) => m.id === value);
    const selectedLabel = selected?.label ?? "Model";

    const favoritesSet = useMemo(() => new Set(favoriteModels), [favoriteModels]);

    const groups = useMemo(() => {
        const seen: string[] = [];
        const hasFavorites = items.some((m) => favoritesSet.has(m.id));
        if (hasFavorites) seen.push("Favorites");
        for (const m of items) {
            if (!seen.includes(m.group)) seen.push(m.group);
        }
        return seen;
    }, [items, favoritesSet]);

    const itemsForGroup = (group: string) => {
        if (group === "Favorites") return items.filter((m) => favoritesSet.has(m.id));
        return items.filter((m) => m.group === group);
    };

    return (
        <DropdownMenu onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className={`flex items-center gap-1.5 rounded-lg px-2 h-8 text-sm transition-colors cursor-pointer text-gray-400 hover:bg-gray-100 hover:text-gray-700 ${isOpen ? "bg-gray-100 text-gray-700" : ""}`}
                    title="Choose model"
                >
                    <span className="max-w-[140px] truncate">{selectedLabel}</span>
                    <ChevronDown
                        className={`h-3 w-3 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 z-50 max-h-80 overflow-y-auto" side="top" align="start">
                {groups.map((group, gi) => {
                    const groupItems = itemsForGroup(group);
                    if (groupItems.length === 0) return null;
                    return (
                        <div key={group}>
                            {gi > 0 && <DropdownMenuSeparator />}
                            <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 flex items-center gap-1.5 py-1.5">
                                {group === "Favorites" && <Star className="h-3 w-3 fill-gray-400 text-gray-400" />}
                                {group}
                            </DropdownMenuLabel>
                            {groupItems.map((m) => {
                                const isFav = favoritesSet.has(m.id);
                                return (
                                    <DropdownMenuItem
                                        key={`${group}-${m.id}`}
                                        className="cursor-pointer"
                                        onSelect={() => onChange(m.id)}
                                    >
                                        {onToggleFavorite && (
                                            <button
                                                type="button"
                                                className="mr-1 shrink-0"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    onToggleFavorite(m.id);
                                                }}
                                                aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
                                            >
                                                <Star
                                                    className={`h-3.5 w-3.5 ${isFav ? "fill-gray-400 text-gray-400" : "text-gray-300 hover:text-gray-500"}`}
                                                />
                                            </button>
                                        )}
                                        <span className="flex-1 truncate">{m.label}</span>
                                        {showZdr && m.zdr && (
                                            <span title="Zero Data Retention — your data is not used for training" className="inline-flex ml-1 shrink-0">
                                                <Shield
                                                    className="h-3.5 w-3.5 text-gray-400 fill-gray-100"
                                                    aria-label="Zero Data Retention"
                                                />
                                            </span>
                                        )}
                                        {m.id === value && (
                                            <Check className="h-3.5 w-3.5 text-gray-500 ml-1" aria-label="Currently selected" />
                                        )}
                                    </DropdownMenuItem>
                                );
                            })}
                        </div>
                    );
                })}
                {items.length === 0 && (
                    <div className="px-3 py-4 text-xs text-gray-400 text-center">
                        No models enabled.{" "}
                        <a href="/account/models" className="underline">
                            Enable models
                        </a>{" "}
                        in Settings.
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
