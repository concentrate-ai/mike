"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
    Check,
    ChevronDown,
    Star,
    ToggleLeft,
    ToggleRight,
    Plus,
    Trash2,
    Loader2,
} from "lucide-react";
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
import {
    CATALOG_PROVIDERS,
    getProviderModels,
    clearProviderModelsCache,
} from "@/app/lib/providerModels";

// ---------------------------------------------------------------------------
// Tier tier info
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ModelsPage() {
    const { profile, updateTierModel, toggleFavoriteModel, setEnabledModels, setCustomModels } =
        useUserProfile();

    // Which provider tab is active in the catalog
    const [activeTab, setActiveTab] = useState<string>("concentrate");

    // Catalog models fetched for the active tab
    const [catalogModels, setCatalogModels] = useState<CatalogModel[]>([]);
    const [catalogLoading, setCatalogLoading] = useState(false);

    // All enabled + custom model ids
    const enabledModels = profile?.enabledModels ?? [];
    const favoriteModels = profile?.favoriteModels ?? [];
    const customModels = (profile?.customModels ?? []) as CustomModelEntry[];

    // Show all provider tabs always — empty tabs show a "no key configured" message
    // rather than hiding the tab entirely, which would make it confusing when a
    // user adds a key and the tab suddenly appears.
    const availableProviders = CATALOG_PROVIDERS;

    // Build flat list of all enabled models for tier dropdowns
    const [allEnabledDetails, setAllEnabledDetails] = useState<CatalogModel[]>([]);

    // Load models for the active tab
    useEffect(() => {
        if (activeTab === "custom") return;
        setCatalogLoading(true);
        getProviderModels(activeTab)
            .then(setCatalogModels)
            .finally(() => setCatalogLoading(false));
    }, [activeTab]);

    // Build full detail list for enabled models (for tier dropdowns)
    useEffect(() => {
        if (!profile) return;
        const ids = new Set(enabledModels);
        if (ids.size === 0) {
            setAllEnabledDetails([]);
            return;
        }
        // Fetch all provider catalogs in parallel and collect matching models
        Promise.all(
            availableProviders
                .filter((p) => p.id !== "custom")
                .map((p) => getProviderModels(p.id)),
        ).then((results) => {
            const flat = results.flat();
            const matched = flat.filter((m) =>
                ids.has(`${m.provider}:${m.id}`),
            );
            // Also include custom models
            const customAsModels: CatalogModel[] = customModels.map((cm) => ({
                provider: cm.provider,
                id: cm.id,
                display_name: cm.display_name,
                is_custom: true,
            }));
            setAllEnabledDetails([...matched, ...customAsModels]);
        });
    }, [enabledModels, profile?.apiKeys]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleToggleEnabled = useCallback(
        async (qualifiedId: string) => {
            const next = enabledModels.includes(qualifiedId)
                ? enabledModels.filter((id) => id !== qualifiedId)
                : [...enabledModels, qualifiedId];
            await setEnabledModels(next);
        },
        [enabledModels, setEnabledModels],
    );

    const handleToggleFavorite = useCallback(
        async (qualifiedId: string) => {
            await toggleFavoriteModel(qualifiedId);
        },
        [toggleFavoriteModel],
    );

    return (
        <div className="space-y-8">
            {/* ── Preferences ── */}
            <div>
                <h2 className="text-2xl font-medium font-serif mb-1">Model Preferences</h2>
                <p className="text-sm text-gray-500 mb-4 max-w-xl">
                    Set a default model for each tier. Jobs that don't specify a
                    model use the Medium tier. Enable models in the catalog below
                    first — only enabled models appear here.
                </p>
                <div className="space-y-4 max-w-md">
                    {TIERS.map((tier) => {
                        const currentValue =
                            tier.id === "high"
                                ? profile?.highModel
                                : tier.id === "medium"
                                  ? profile?.mediumModel
                                  : profile?.lowModel;
                        return (
                            <div key={tier.id}>
                                <label className="text-sm font-medium text-gray-700 block mb-0.5">
                                    {tier.label}
                                </label>
                                <p className="text-xs text-gray-400 mb-1.5">{tier.description}</p>
                                <TierDropdown
                                    value={currentValue ?? null}
                                    models={allEnabledDetails}
                                    placeholder={`Server default (auto)`}
                                    onChange={(v) => updateTierModel(tier.id, v)}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Catalog ── */}
            <div>
                <h2 className="text-2xl font-medium font-serif mb-1">Model Catalog</h2>
                <p className="text-sm text-gray-500 mb-4 max-w-xl">
                    Enable models to make them available for tier selection above
                    and in the per-review model picker. Star to mark favorites.
                </p>

                {/* Provider tabs */}
                <div className="flex gap-1 mb-4 flex-wrap">
                    {availableProviders.map((p) => (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => setActiveTab(p.id)}
                            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                activeTab === p.id
                                    ? "bg-gray-900 text-white"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => setActiveTab("custom")}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                            activeTab === "custom"
                                ? "bg-gray-900 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                    >
                        + Custom
                    </button>
                </div>

                {activeTab === "custom" ? (
                    <CustomModelsTab
                        customModels={customModels}
                        enabledModels={enabledModels}
                        onSave={setCustomModels}
                        onToggleEnabled={handleToggleEnabled}
                    />
                ) : catalogLoading ? (
                    <div className="flex items-center gap-2 py-8 text-gray-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Loading…</span>
                    </div>
                ) : catalogModels.length === 0 ? (
                    <div className="py-10 flex flex-col items-start gap-3">
                        <span className="inline-flex items-center rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow">
                            No models returned for this provider
                        </span>
                        <p className="text-xs text-gray-400 pl-1">
                            Add a key on the{" "}
                            <a href="/account/api-keys" className="underline text-gray-600 hover:text-gray-800">
                                Providers
                            </a>{" "}
                            page, then{" "}
                            <button
                                type="button"
                                className="underline text-gray-600 hover:text-gray-800"
                                onClick={() => {
                                    clearProviderModelsCache(activeTab);
                                    setCatalogLoading(true);
                                    getProviderModels(activeTab)
                                        .then(setCatalogModels)
                                        .finally(() => setCatalogLoading(false));
                                }}
                            >
                                retry
                            </button>
                            .
                        </p>
                    </div>
                ) : (
                    <CatalogTable
                        models={catalogModels}
                        enabledModels={enabledModels}
                        favoriteModels={favoriteModels}
                        onToggleEnabled={handleToggleEnabled}
                        onToggleFavorite={handleToggleFavorite}
                    />
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Tier dropdown
// ---------------------------------------------------------------------------

function TierDropdown({
    value,
    models,
    placeholder,
    onChange,
}: {
    value: string | null;
    models: CatalogModel[];
    placeholder: string;
    onChange: (value: string | null) => Promise<boolean>;
}) {
    const [open, setOpen] = useState(false);
    const selected = value ? models.find((m) => `${m.provider}:${m.id}` === value) : null;

    // Group by provider
    const groups: string[] = [];
    for (const m of models) {
        if (!groups.includes(m.provider)) groups.push(m.provider);
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
                    <ChevronDown
                        className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
                    />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                className="z-50"
                style={{ width: "var(--radix-dropdown-menu-trigger-width)" }}
                align="start"
            >
                <DropdownMenuItem
                    className="cursor-pointer text-gray-400"
                    onSelect={() => onChange(null)}
                >
                    <span className="flex-1 italic">{placeholder}</span>
                    {!value && <Check className="h-3.5 w-3.5 ml-1 text-gray-400" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {groups.map((group, gi) => {
                    const items = models.filter((m) => m.provider === group);
                    return (
                        <div key={group}>
                            {gi > 0 && <DropdownMenuSeparator />}
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-gray-400">
                                {group}
                            </DropdownMenuLabel>
                            {items.map((m) => {
                                const qid = `${m.provider}:${m.id}`;
                                return (
                                    <DropdownMenuItem
                                        key={qid}
                                        className="cursor-pointer"
                                        onSelect={() => onChange(qid)}
                                    >
                                        <span className="flex-1">{m.display_name}</span>
                                        {value === qid && (
                                            <Check className="h-3.5 w-3.5 text-gray-600 ml-1" />
                                        )}
                                    </DropdownMenuItem>
                                );
                            })}
                        </div>
                    );
                })}
                {models.length === 0 && (
                    <DropdownMenuItem disabled className="text-gray-400 text-xs">
                        No enabled models — enable models in the catalog below.
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

// ---------------------------------------------------------------------------
// Catalog table
// ---------------------------------------------------------------------------

function CatalogTable({
    models,
    enabledModels,
    favoriteModels,
    onToggleEnabled,
    onToggleFavorite,
}: {
    models: CatalogModel[];
    enabledModels: string[];
    favoriteModels: string[];
    onToggleEnabled: (qualifiedId: string) => Promise<void>;
    onToggleFavorite: (qualifiedId: string) => Promise<void>;
}) {
    return (
        <div className="rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm table-fixed">
                <colgroup>
                    {/* enabled dot */}
                    <col style={{ width: "32px" }} />
                    {/* star */}
                    <col style={{ width: "28px" }} />
                    {/* name + slug */}
                    <col className="w-auto" />
                    {/* capabilities */}
                    <col style={{ width: "120px" }} />
                    {/* CTX */}
                    <col style={{ width: "58px" }} />
                    {/* IN/M */}
                    <col style={{ width: "68px" }} />
                    {/* OUT/M */}
                    <col style={{ width: "76px" }} />
                </colgroup>
                <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="px-2 py-2"></th>
                        <th className="px-2 py-2"></th>
                        <th className="text-left px-3 py-2 font-medium text-gray-400 text-xs uppercase tracking-wide">
                            Model
                        </th>
                        <th className="px-2 py-2 font-medium text-gray-400 text-xs uppercase tracking-wide text-center">
                            Capabilities
                        </th>
                        <th className="text-right px-3 py-2 font-medium text-gray-400 text-xs uppercase tracking-wide">
                            CTX
                        </th>
                        <th className="text-right px-3 py-2 font-medium text-gray-400 text-xs uppercase tracking-wide">
                            IN/M
                        </th>
                        <th className="text-right px-3 py-2 font-medium text-gray-400 text-xs uppercase tracking-wide">
                            OUT/M
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {models.map((m, i) => {
                        const qid = `${m.provider}:${m.id}`;
                        const enabled = enabledModels.includes(qid);
                        const favorite = favoriteModels.includes(qid);
                        const showGroupHeader =
                            m.vendor_group &&
                            m.vendor_group !== models[i - 1]?.vendor_group;
                        return (
                            <React.Fragment key={qid}>
                            {showGroupHeader && (
                                <tr className="border-b border-gray-100 bg-gray-50/80">
                                    <td colSpan={7} className="px-4 py-1.5">
                                        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                                            {m.vendor_group}
                                        </span>
                                    </td>
                                </tr>
                            )}
                            <tr className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                                {/* Enabled toggle dot */}
                                <td className="px-2 py-2 text-center">
                                    <button
                                        type="button"
                                        onClick={() => onToggleEnabled(qid)}
                                        aria-label={enabled ? "Disable model" : "Enable model"}
                                        className="flex items-center justify-center w-full"
                                    >
                                        <span className={`inline-block w-3 h-3 rounded-full border-2 transition-colors ${
                                            enabled
                                                ? "bg-emerald-500 border-emerald-500"
                                                : "bg-transparent border-gray-300 hover:border-gray-400"
                                        }`} />
                                    </button>
                                </td>
                                {/* Star */}
                                <td className="px-2 py-2 text-center">
                                    <button
                                        type="button"
                                        onClick={() => onToggleFavorite(qid)}
                                        className="transition-colors"
                                        aria-label={favorite ? "Unstar model" : "Star model"}
                                    >
                                        <Star className={`h-3.5 w-3.5 ${favorite ? "fill-amber-400 text-amber-400" : "text-gray-200 hover:text-gray-300"}`} />
                                    </button>
                                </td>
                                {/* Name + slug */}
                                <td className="px-3 py-2 overflow-hidden">
                                    <div className="flex items-baseline gap-2 min-w-0">
                                        <span className={`font-medium text-sm whitespace-nowrap ${enabled ? "text-gray-900" : "text-gray-400"}`}>
                                            {m.display_name}
                                        </span>
                                        <span className="text-[11px] text-gray-300 font-mono truncate min-w-0">
                                            {m.id}
                                        </span>
                                    </div>
                                </td>
                                {/* Capability icons — colored */}
                                <td className="px-2 py-2">
                                    <div className="flex items-center justify-center gap-1">
                                        <CapIcon type="tools" active={!!m.supports_tools} />
                                        <CapIcon type="images" active={!!m.supports_images} />
                                        <CapIcon type="pdf" active={!!m.supports_pdf} />
                                        <CapIcon type="reasoning" active={!!m.supports_reasoning} />
                                        <CapIcon type="zdr" active={!!m.zdr} />
                                    </div>
                                </td>
                                <td className="px-3 py-2 text-right text-gray-400 text-xs font-mono">
                                    {m.context_window ? formatK(m.context_window) : "—"}
                                </td>
                                <td className="px-3 py-2 text-right text-xs font-mono">
                                    <span className={m.input_price_per_m != null ? "text-gray-500" : "text-gray-200"}>
                                        {m.input_price_per_m != null ? `$${m.input_price_per_m.toFixed(2)}` : "—"}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-right text-xs font-mono">
                                    <span className={m.output_price_per_m != null ? "text-gray-500" : "text-gray-200"}>
                                        {m.output_price_per_m != null ? `$${m.output_price_per_m.toFixed(2)}` : "—"}
                                    </span>
                                </td>
                            </tr>
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// Capability icons — colored when active, gray ghost when inactive
function CapIcon({ type, active }: { type: "tools" | "images" | "pdf" | "reasoning" | "zdr"; active: boolean }) {
    const size = "w-4 h-4 shrink-0";

    if (type === "tools") {
        const cls = active ? `${size} text-blue-500` : `${size} text-gray-200`;
        return (
            <svg title="Tool use" className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 13L10 6M13 3a2 2 0 01-3 3L6 10l-3 1 1-3 4-4a2 2 0 013-3z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        );
    }
    if (type === "images") {
        const cls = active ? `${size} text-violet-500` : `${size} text-gray-200`;
        return (
            <svg title="Vision / images" className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/>
                <circle cx="5.5" cy="6" r="1.25"/>
                <path d="M1.5 11l3.5-3.5 2.5 2.5 2-2 4 4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        );
    }
    if (type === "pdf") {
        const cls = active ? `${size} text-orange-500` : `${size} text-gray-200`;
        return (
            <svg title="PDF support" className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 1.5H4a1 1 0 00-1 1v11a1 1 0 001 1h8a1 1 0 001-1V6L9 1.5z" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 1.5V6h4.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5 9.5h6M5 11.5h4" strokeLinecap="round"/>
            </svg>
        );
    }
    if (type === "reasoning") {
        const cls = active ? `${size} text-amber-500` : `${size} text-gray-200`;
        return (
            <svg title="Reasoning / thinking" className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8 1.5a4.5 4.5 0 014.5 4.5c0 1.8-1 3.3-2.5 4.1V11.5a1 1 0 01-1 1h-2a1 1 0 01-1-1v-1.4A4.5 4.5 0 018 1.5z" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M6.5 14.5h3" strokeLinecap="round"/>
            </svg>
        );
    }
    // ZDR shield — green fill when active, ghost when not
    if (active) {
        return (
            <svg title="Zero Data Retention" className={`${size} text-emerald-500`} viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1L2 3.5v5C2 11.8 4.7 14.5 8 15.5c3.3-1 6-3.7 6-7V3.5L8 1z"/>
                <path d="M5.5 8l1.8 1.8L10.5 6.5" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        );
    }
    return (
        <svg title="Zero Data Retention (not available)" className={`${size} text-gray-200`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 1L2 3.5v5C2 11.8 4.7 14.5 8 15.5c3.3-1 6-3.7 6-7V3.5L8 1z" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    );
}

function formatK(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return String(n);
}

// ---------------------------------------------------------------------------
// Custom models tab
// ---------------------------------------------------------------------------

type CustomModelEntry = {
    provider: string;
    id: string;
    display_name: string;
    input_price_per_m?: number | null;
    output_price_per_m?: number | null;
};

function CustomModelsTab({
    customModels,
    enabledModels,
    onSave,
    onToggleEnabled,
}: {
    customModels: CustomModelEntry[];
    enabledModels: string[];
    onSave: (models: unknown[]) => Promise<boolean>;
    onToggleEnabled: (qualifiedId: string) => Promise<void>;
}) {
    const [form, setForm] = useState({
        provider: "generic",
        id: "",
        display_name: "",
        input_price_per_m: "",
        output_price_per_m: "",
    });
    const [adding, setAdding] = useState(false);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.id.trim() || !form.display_name.trim()) return;
        const entry: CustomModelEntry = {
            provider: form.provider,
            id: form.id.trim(),
            display_name: form.display_name.trim(),
            input_price_per_m: form.input_price_per_m
                ? parseFloat(form.input_price_per_m)
                : null,
            output_price_per_m: form.output_price_per_m
                ? parseFloat(form.output_price_per_m)
                : null,
        };
        setAdding(true);
        const ok = await onSave([...customModels, entry]);
        setAdding(false);
        if (ok) {
            setForm({ provider: "generic", id: "", display_name: "", input_price_per_m: "", output_price_per_m: "" });
        }
    };

    const handleRemove = async (index: number) => {
        const next = customModels.filter((_, i) => i !== index);
        await onSave(next);
    };

    return (
        <div className="space-y-4">
            {customModels.length > 0 && (
                <div className="rounded-xl border border-gray-100 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50">
                                <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">
                                    Model
                                </th>
                                <th className="text-center px-4 py-2.5 font-medium text-gray-500 text-xs">
                                    Enabled
                                </th>
                                <th className="px-4 py-2.5" />
                            </tr>
                        </thead>
                        <tbody>
                            {customModels.map((m, i) => {
                                const qid = `${m.provider}:${m.id}`;
                                const enabled = enabledModels.includes(qid);
                                return (
                                    <tr
                                        key={i}
                                        className="border-b border-gray-50 last:border-0 hover:bg-gray-50"
                                    >
                                        <td className="px-4 py-2.5">
                                            <div className="font-medium text-gray-900">
                                                {m.display_name}
                                            </div>
                                            <div className="text-xs text-gray-400 font-mono mt-0.5">
                                                {m.provider}:{m.id}
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5 text-center">
                                            <button
                                                type="button"
                                                onClick={() => onToggleEnabled(qid)}
                                            >
                                                {enabled ? (
                                                    <ToggleRight className="h-5 w-5 text-gray-900" />
                                                ) : (
                                                    <ToggleLeft className="h-5 w-5 text-gray-400" />
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            <button
                                                type="button"
                                                onClick={() => handleRemove(i)}
                                                className="text-gray-400 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <form
                onSubmit={handleAdd}
                className="rounded-xl border border-dashed border-gray-200 p-4 space-y-3"
            >
                <p className="text-xs font-medium text-gray-600">Add custom model slug</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">
                            Provider
                        </label>
                        <select
                            value={form.provider}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, provider: e.target.value }))
                            }
                            className="w-full h-8 rounded-md border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                        >
                            <option value="generic">Custom Endpoint</option>
                            <option value="concentrate">Concentrate</option>
                            <option value="claude">Anthropic</option>
                            <option value="gemini">Google</option>
                            <option value="openai">OpenAI</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">
                            Model ID (slug) *
                        </label>
                        <input
                            type="text"
                            required
                            value={form.id}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, id: e.target.value }))
                            }
                            placeholder="e.g. my-model-v1"
                            className="w-full h-8 rounded-md border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">
                            Display name *
                        </label>
                        <input
                            type="text"
                            required
                            value={form.display_name}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, display_name: e.target.value }))
                            }
                            placeholder="My Model v1"
                            className="w-full h-8 rounded-md border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                        />
                    </div>
                    <div className="sm:col-span-2 flex gap-3">
                        <div className="flex-1">
                            <label className="text-xs text-gray-500 block mb-1">
                                Input $/M tokens (optional)
                            </label>
                            <input
                                type="number"
                                step="any"
                                value={form.input_price_per_m}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        input_price_per_m: e.target.value,
                                    }))
                                }
                                placeholder="e.g. 0.50"
                                className="w-full h-8 rounded-md border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs text-gray-500 block mb-1">
                                Output $/M tokens (optional)
                            </label>
                            <input
                                type="number"
                                step="any"
                                value={form.output_price_per_m}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        output_price_per_m: e.target.value,
                                    }))
                                }
                                placeholder="e.g. 1.50"
                                className="w-full h-8 rounded-md border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                            />
                        </div>
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={adding || !form.id.trim() || !form.display_name.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
                >
                    {adding ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <Plus className="h-3.5 w-3.5" />
                    )}
                    Add model
                </button>
            </form>
        </div>
    );
}
