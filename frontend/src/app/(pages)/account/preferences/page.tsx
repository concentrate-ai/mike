"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Shield } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUserProfile } from "@/contexts/UserProfileContext";
import type { CatalogModel } from "@/app/lib/mikeApi";
import { getMergedModels } from "@/app/lib/providerModels";

const TIERS = [
    {
        id: "high" as const,
        label: "High",
        description: "Flagship reasoning — used for assistant chat default and high-tier jobs.",
    },
    {
        id: "medium" as const,
        label: "Medium",
        description: "Balanced default — fallback tier and default for tabular reviews.",
    },
    {
        id: "low" as const,
        label: "Low",
        description: "Cheapest, fastest — used for title generation and low-tier jobs.",
    },
];

export default function PreferencesPage() {
    const { profile, updateTierModel } = useUserProfile();
    const [allModels, setAllModels] = useState<CatalogModel[]>([]);
    const enabledModels = profile?.enabledModels ?? [];

    useEffect(() => {
        getMergedModels().then(setAllModels).catch(() => {});
    }, []);

    const enabledDetails = allModels.filter((m) =>
        enabledModels.includes(`${m.provider}:${m.id}`)
    );

    return (
        <div className="space-y-6 max-w-md">
            <div>
                <h2 className="text-2xl font-medium font-serif">Model Preferences</h2>
                <p className="text-sm text-gray-400 mt-1">
                    Set a default model for each tier. Jobs that don't specify a model
                    use the Medium tier. Enable models on a provider page first.
                </p>
            </div>

            <div className="space-y-5">
                {TIERS.map((tier) => {
                    const currentValue =
                        tier.id === "high" ? profile?.highModel
                        : tier.id === "medium" ? profile?.mediumModel
                        : profile?.lowModel;
                    return (
                        <div key={tier.id}>
                            <label className="text-sm font-medium text-gray-700 block mb-0.5">
                                {tier.label}
                            </label>
                            <p className="text-xs text-gray-400 mb-1.5">{tier.description}</p>
                            <TierDropdown
                                value={currentValue ?? null}
                                models={enabledDetails}
                                placeholder="Server default (auto)"
                                onChange={(v) => updateTierModel(tier.id, v)}
                            />
                        </div>
                    );
                })}
            </div>

            {enabledDetails.length === 0 && (
                <p className="text-xs text-gray-400">
                    No models enabled yet.{" "}
                    <a href="/account/providers/concentrate" className="underline hover:text-gray-600">
                        Enable models
                    </a>{" "}
                    on a provider page first.
                </p>
            )}
        </div>
    );
}

// Provider display order: Anthropic first, then alphabetical
const PROVIDER_ORDER: Record<string, number> = {
    claude: 1,
    anthropic: 1,
    concentrate: 2,
    gemini: 3,
    google: 3,
    openai: 4,
};

const PROVIDER_LABEL: Record<string, string> = {
    claude: "Anthropic",
    anthropic: "Anthropic",
    concentrate: "Concentrate",
    gemini: "Google",
    google: "Google",
    openai: "OpenAI",
};

function TierDropdown({
    value, models, placeholder, onChange,
}: {
    value: string | null;
    models: CatalogModel[];
    placeholder: string;
    onChange: (value: string | null) => Promise<boolean>;
}) {
    const [open, setOpen] = useState(false);
    const selected = value ? models.find((m) => `${m.provider}:${m.id}` === value) : null;

    // Group by provider, sort providers by order, sort models within each group by name
    const groups = models.reduce<Record<string, CatalogModel[]>>((acc, m) => {
        const key = m.provider;
        if (!acc[key]) acc[key] = [];
        acc[key].push(m);
        return acc;
    }, {});

    const sortedProviders = Object.keys(groups).sort((a, b) => {
        const oa = PROVIDER_ORDER[a] ?? 99;
        const ob = PROVIDER_ORDER[b] ?? 99;
        if (oa !== ob) return oa - ob;
        return a.localeCompare(b);
    });

    for (const provider of sortedProviders) {
        groups[provider].sort((a, b) => a.display_name.localeCompare(b.display_name));
    }

    return (
        <DropdownMenu onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm shadow-sm flex items-center justify-between gap-2 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/10"
                >
                    <span className="truncate text-gray-900">
                        {selected ? selected.display_name : placeholder}
                    </span>
                    <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                className="z-50 max-h-72 overflow-y-auto"
                style={{ width: "var(--radix-dropdown-menu-trigger-width)" }}
                align="start"
            >
                <DropdownMenuItem className="cursor-pointer text-gray-400" onSelect={() => onChange(null)}>
                    <span className="flex-1 italic">{placeholder}</span>
                    {!value && <Check className="h-3.5 w-3.5 ml-1 text-gray-400" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {sortedProviders.map((provider, pi) => (
                    <div key={provider}>
                        {pi > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-gray-400 py-1">
                            {PROVIDER_LABEL[provider] ?? provider}
                        </DropdownMenuLabel>
                        {groups[provider].map((m) => {
                    const qid = `${m.provider}:${m.id}`;
                    return (
                        <DropdownMenuItem key={qid} className="cursor-pointer" onSelect={() => onChange(qid)}>
                            <span className="flex-1">{m.display_name}</span>
                            {value === qid && <Check className="h-3.5 w-3.5 text-gray-600 shrink-0 ml-1" />}
                            <span className="w-5 flex justify-center shrink-0">
                                {m.zdr && (
                                    <span title="Zero Data Retention">
                                        <Shield className="h-3.5 w-3.5 text-gray-400 fill-gray-100" />
                                    </span>
                                )}
                            </span>
                        </DropdownMenuItem>
                    );
                })}
                    </div>
                ))}
                {models.length === 0 && (
                    <DropdownMenuItem disabled className="text-gray-400 text-xs">
                        No enabled models.
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
