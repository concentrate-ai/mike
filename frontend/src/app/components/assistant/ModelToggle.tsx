"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Check, AlertCircle } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isModelAvailable } from "@/app/lib/modelAvailability";
import type { ApiKeyState } from "@/app/lib/mikeApi";
import { MODELS, type ModelOption } from "@/app/lib/models";
import { fetchConcentrateModels } from "@/app/lib/concentrateModels";

export { MODELS, type ModelOption } from "@/app/lib/models";
export { DEFAULT_MODEL_ID, ALLOWED_MODEL_IDS } from "@/app/lib/models";

export function useModels(apiKeys?: ApiKeyState): {
    models: ModelOption[];
    dynamicIds: Set<string>;
} {
    const [concentrateModels, setConcentrateModels] = useState<ModelOption[]>([]);

    useEffect(() => {
        if (!apiKeys?.concentrate?.configured) {
            setConcentrateModels([]);
            return;
        }
        fetchConcentrateModels(apiKeys).then(setConcentrateModels).catch(() => {});
    }, [apiKeys?.concentrate?.configured]);

    return useMemo(() => {
        const all = [...MODELS, ...concentrateModels];
        const dynamicIds = new Set(concentrateModels.map((m) => m.id));
        return { models: all, dynamicIds };
    }, [concentrateModels]);
}

interface Props {
    value: string;
    onChange: (id: string) => void;
    apiKeys?: ApiKeyState;
    models?: ModelOption[];
}

export function ModelToggle({ value, onChange, apiKeys, models }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const items = models ?? MODELS;
    const selected = items.find((m) => m.id === value);
    const selectedLabel = selected?.label ?? "Model";
    const selectedAvailable = apiKeys
        ? isModelAvailable(value, apiKeys)
        : true;

    const groups = useMemo(() => {
        const seen: string[] = [];
        for (const m of items) {
            if (!seen.includes(m.group)) seen.push(m.group);
        }
        return seen;
    }, [items]);

    return (
        <DropdownMenu onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className={`flex items-center gap-1.5 rounded-lg px-2 h-8 text-sm transition-colors cursor-pointer text-gray-400 hover:bg-gray-100 hover:text-gray-700 ${isOpen ? "bg-gray-100 text-gray-700" : ""}`}
                    title={
                        !selectedAvailable
                            ? "API key missing for selected model"
                            : "Choose model"
                    }
                >
                    {!selectedAvailable && (
                        <AlertCircle className="h-3 w-3 shrink-0 text-red-500" />
                    )}
                    <span className="max-w-[140px] truncate">{selectedLabel}</span>
                    <ChevronDown
                        className={`h-3 w-3 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 z-50 max-h-80 overflow-y-auto" side="top" align="start">
                {groups.map((group, gi) => {
                    const groupItems = items.filter((m) => m.group === group);
                    if (groupItems.length === 0) return null;
                    return (
                        <div key={group}>
                            {gi > 0 && <DropdownMenuSeparator />}
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-gray-400">
                                {group}
                            </DropdownMenuLabel>
                            {groupItems.map((m) => {
                                const available = apiKeys
                                    ? isModelAvailable(m.id, apiKeys)
                                    : true;
                                return (
                                    <DropdownMenuItem
                                        key={m.id}
                                        className="cursor-pointer"
                                        onSelect={() => onChange(m.id)}
                                    >
                                        <span
                                            className={`flex-1 ${available ? "" : "text-gray-400"}`}
                                        >
                                            {m.label}
                                        </span>
                                        {!available && (
                                            <AlertCircle
                                                className="h-3.5 w-3.5 text-red-500 ml-1"
                                                aria-label="API key missing"
                                            />
                                        )}
                                        {m.id === value && available && (
                                            <Check className="h-3.5 w-3.5 text-gray-600 ml-1" />
                                        )}
                                    </DropdownMenuItem>
                                );
                            })}
                        </div>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
