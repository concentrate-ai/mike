"use client";

import { useMemo, useState } from "react";
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
import type { ModelOption } from "@/app/lib/models";
import { MODELS } from "@/app/lib/models";

// Re-export for callers that still import from here
export { MODELS, type ModelOption } from "@/app/lib/models";
export { DEFAULT_MODEL_ID, ALLOWED_MODEL_IDS } from "@/app/lib/models";

const PROVIDER_LABELS: Record<string, string> = {
    concentrate: "Concentrate",
    claude: "Anthropic",
    gemini: "Google",
    openai: "OpenAI",
    generic: "Custom",
};

function qualifiedIdToOption(qid: string): ModelOption | null {
    const colon = qid.indexOf(":");
    if (colon === -1) {
        // Legacy bare id — fall back to hardcoded MODELS list
        return MODELS.find((m) => m.id === qid) ?? null;
    }
    const provider = qid.slice(0, colon);
    const slug = qid.slice(colon + 1);
    const group = PROVIDER_LABELS[provider] ?? provider;
    // Pretty-print: try to match a known label from the hardcoded list first
    const known = MODELS.find((m) => m.id === slug);
    return {
        id: qid,          // use qualified id so routing knows the provider
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
): {
    models: ModelOption[];
    dynamicIds: Set<string>;
} {
    return useMemo(() => {
        const source = enabledModels && enabledModels.length > 0 ? enabledModels : null;

        if (!source) {
            // Fallback: hardcoded list with bare ids (legacy behaviour)
            return {
                models: MODELS,
                dynamicIds: new Set(MODELS.map((m) => m.id)),
            };
        }

        const models = source
            .map(qualifiedIdToOption)
            .filter((m): m is ModelOption => m !== null);

        return {
            models,
            dynamicIds: new Set(models.map((m) => m.id)),
        };
    }, [enabledModels]);
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
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-gray-400">
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
                                                    className={`h-3.5 w-3.5 ${isFav ? "fill-yellow-400 text-yellow-400" : "text-gray-300 hover:text-yellow-400"}`}
                                                />
                                            </button>
                                        )}
                                        <span className="flex-1 truncate">{m.label}</span>
                                        {showZdr && m.zdr && (
                                            <Shield
                                                className="h-3 w-3 text-green-600 ml-1 shrink-0"
                                                aria-label="Zero data retention"
                                            />
                                        )}
                                        {m.id === value && (
                                            <Check className="h-3.5 w-3.5 text-gray-600 ml-1" />
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
