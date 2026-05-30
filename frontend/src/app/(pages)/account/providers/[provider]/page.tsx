"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
    Check, CheckCircle2, Eye, EyeOff, Lock,
    Loader2, Star, XCircle, Shield,
} from "lucide-react";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { verifyApiKey as verifyApiKeyRequest } from "@/app/lib/mikeApi";
import type { CatalogModel } from "@/app/lib/mikeApi";
import { getProviderModels, getMergedModels, clearProviderModelsCache } from "@/app/lib/providerModels";

// ---------------------------------------------------------------------------
// Provider config
// ---------------------------------------------------------------------------

type ProviderConfig = {
    label: string;
    envVar: string;
    placeholder: string;
    apiKeyField: string;  // key into profile.apiKeys
    description?: string;
    link?: string;
    catalogProvider: string;
    zdrToggle?: boolean;
    enterpriseNote?: string; // shown when ZDR is not available via standard key
};

const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
    anthropic: {
        label: "Anthropic",
        envVar: "ANTHROPIC_API_KEY",
        placeholder: "sk-ant-…",
        apiKeyField: "claude",
        catalogProvider: "anthropic",
        enterpriseNote: "ZDR requires an Anthropic enterprise agreement. Standard API keys do not include ZDR.",
    },
    concentrate: {
        label: "Concentrate",
        envVar: "CONCENTRATE_API_KEY",
        placeholder: "sk-cn-…",
        apiKeyField: "concentrate",
        description: "Routes to 100+ models. Mike uses Zero Data Retention (ZDR) models only — your data is never used for training.",
        link: "https://concentrate.ai",
        catalogProvider: "concentrate",
        zdrToggle: true,
    },
    google: {
        label: "Google",
        envVar: "GEMINI_API_KEY",
        placeholder: "AIza…",
        apiKeyField: "gemini",
        catalogProvider: "gemini",
        enterpriseNote: "ZDR requires a Google Cloud enterprise agreement. Standard API keys do not include ZDR.",
    },
    openai: {
        label: "OpenAI",
        envVar: "OPENAI_API_KEY",
        placeholder: "sk-…",
        apiKeyField: "openai",
        catalogProvider: "openai",
        enterpriseNote: "ZDR requires an OpenAI enterprise agreement. Standard API keys do not include ZDR.",
    },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProviderPage() {
    const params = useParams<{ provider: string }>();
    const provider = params.provider;
    const config = PROVIDER_CONFIGS[provider];

    const { profile, updateApiKey, toggleFavoriteModel, setEnabledModels } = useUserProfile();

    const [models, setModels] = useState<CatalogModel[]>([]);
    const [loading, setLoading] = useState(false);
    const [zdrOnly, setZdrOnly] = useState(config?.zdrToggle ?? false);

    const enabledModels = profile?.enabledModels ?? [];
    const favoriteModels = profile?.favoriteModels ?? [];
    const configured = !!profile?.apiKeys[config?.apiKeyField as keyof typeof profile.apiKeys]?.configured;
    const serverConfigured = profile?.apiKeys[config?.apiKeyField as keyof typeof profile.apiKeys]?.source === "env";

    useEffect(() => {
        if (!config || !configured) { setModels([]); return; }
        setLoading(true);
        // Frontier providers: fetch direct, no ZDR overlay — ZDR requires
        // Concentrate routing or a separate enterprise agreement with the provider.
        // Concentrate: its own endpoint already has accurate ZDR flags.
        getProviderModels(config.catalogProvider)
            .then(setModels)
            .finally(() => setLoading(false));
    }, [configured, provider]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleToggleEnabled = useCallback(async (qid: string) => {
        const next = enabledModels.includes(qid)
            ? enabledModels.filter((id) => id !== qid)
            : [...enabledModels, qid];
        await setEnabledModels(next);
    }, [enabledModels, setEnabledModels]);

    const handleToggleFavorite = useCallback(async (qid: string) => {
        await toggleFavoriteModel(qid);
    }, [toggleFavoriteModel]);

    if (!config) {
        return <div className="text-sm text-gray-400">Unknown provider.</div>;
    }

    const displayModels = config.zdrToggle && zdrOnly
        ? models.filter((m) => m.zdr)
        : models;

    return (
        <div className="space-y-6 md:space-y-8 w-full max-w-2xl">
            {/* Header */}
            <div>
                <h2 className="text-xl md:text-2xl font-medium font-serif">{config.label}</h2>
                {config.description && (
                    <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                        {config.description}
                        {config.link && (
                            <> <a href={config.link} target="_blank" rel="noopener noreferrer"
                                className="underline underline-offset-2 hover:text-gray-700 transition-colors">
                                {config.link.replace(/^https?:\/\//, "")}
                            </a></>
                        )}
                    </p>
                )}
                {config.enterpriseNote && (
                    <p className="text-xs text-gray-400 mt-1">
                        <span className="font-medium text-gray-500">ZDR:</span> {config.enterpriseNote}{" "}
                        <a href="/account/providers/concentrate" className="underline underline-offset-2 hover:text-gray-600 transition-colors">
                            Use Concentrate for ZDR.
                        </a>
                    </p>
                )}
            </div>

            {/* Key entry */}
            <div className="rounded-xl border border-gray-100">
                <KeyRow
                    provider={provider}
                    apiKeyField={config.apiKeyField}
                    label={config.label}
                    envVar={config.envVar}
                    placeholder={config.placeholder}
                    configured={configured}
                    serverConfigured={serverConfigured}
                    onSave={(value) => updateApiKey(config.apiKeyField as Parameters<typeof updateApiKey>[0], value || null)}
                    onRemove={() => updateApiKey(config.apiKeyField as Parameters<typeof updateApiKey>[0], null)}
                    onKeyAdded={() => {
                        clearProviderModelsCache();
                        setLoading(true);
                        getProviderModels(config.catalogProvider)
                            .then(setModels)
                            .finally(() => setLoading(false));
                    }}
                />
            </div>

            {/* Model list */}
            {configured && (
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-widest text-xs">Models</h3>
                        {config.zdrToggle && (
                            <button
                                type="button"
                                onClick={() => setZdrOnly((v) => !v)}
                                className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-800 transition-colors"
                                title="Zero Data Retention — your data is never used for training"
                            >
                                <span className={`relative inline-flex h-4 w-7 shrink-0 rounded-full border transition-colors ${zdrOnly ? "bg-gray-900 border-gray-900" : "bg-gray-200 border-gray-200"}`}>
                                    <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${zdrOnly ? "translate-x-3" : "translate-x-0.5"}`} />
                                </span>
                                ZDR only
                            </button>
                        )}
                    </div>

                    {loading ? (
                        <div className="flex items-center gap-2 py-8 text-gray-400">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">Loading…</span>
                        </div>
                    ) : displayModels.length === 0 ? (
                        <p className="text-sm text-gray-400 py-4">
                            {config.zdrToggle && zdrOnly
                                ? "No ZDR models available. Toggle ZDR only off to see all models."
                                : "No models found."}
                        </p>
                    ) : (
                        <CatalogTable
                            models={displayModels}
                            enabledModels={enabledModels}
                            favoriteModels={favoriteModels}
                            onToggleEnabled={handleToggleEnabled}
                            onToggleFavorite={handleToggleFavorite}
                        />
                    )}
                </div>
            )}

            {!configured && (
                <div className="py-6 text-sm text-gray-400">
                    Add your {config.label} key above to see available models.
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Key row (adapted from api-keys page)
// ---------------------------------------------------------------------------

function KeyRow({
    provider,
    label,
    envVar,
    placeholder,
    configured,
    serverConfigured,
    onSave,
    onRemove,
    onKeyAdded,
}: {
    provider: string;
    apiKeyField: string;
    label: string;
    envVar: string;
    placeholder: string;
    configured: boolean;
    serverConfigured: boolean;
    onSave: (value: string) => Promise<boolean>;
    onRemove: () => Promise<boolean>;
    onKeyAdded: () => void;
}) {
    const [value, setValue] = useState("");
    const [reveal, setReveal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [justSaved, setJustSaved] = useState(false);
    const [verified, setVerified] = useState<boolean | null>(null);
    const [verifying, setVerifying] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const runVerify = async () => {
        setVerifying(true);
        try {
            const ok = await verifyApiKeyRequest(provider as Parameters<typeof verifyApiKeyRequest>[0]);
            setVerified(ok);
        } catch { setVerified(false); }
        finally { setVerifying(false); }
    };

    useEffect(() => {
        setValue("");
        if (configured || serverConfigured) runVerify();
        else setVerified(null);
    }, [configured, serverConfigured]); // eslint-disable-line react-hooks/exhaustive-deps

    const dirty = value.trim().length > 0;

    const handleSave = async () => {
        if (!dirty) return;
        setSaving(true);
        const ok = await onSave(value.trim());
        setSaving(false);
        if (ok) {
            setValue("");
            setJustSaved(true);
            setTimeout(() => setJustSaved(false), 2000);
            setExpanded(false);
            runVerify();
            onKeyAdded();
        }
    };

    const handleRemove = async () => {
        setSaving(true);
        await onRemove();
        setSaving(false);
        setVerified(null);
    };

    let statusNode: React.ReactNode = null;
    if (verifying) {
        statusNode = <span className="text-xs text-gray-400 animate-pulse">checking…</span>;
    } else if (verified === true) {
        statusNode = (
            <span title="Key verified" className="flex items-center gap-1 text-xs text-gray-400 cursor-default">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /><span>Verified</span>
            </span>
        );
    } else if (verified === false) {
        statusNode = (
            <span title="Key check failed" className="flex items-center gap-1 text-xs text-gray-700 cursor-default">
                <XCircle className="h-3.5 w-3.5 shrink-0" /><span>Invalid</span>
            </span>
        );
    }

    return (
        <div className="px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-medium text-gray-900 truncate shrink-0">{label}</span>
                <code className="text-[11px] text-gray-300 font-mono tracking-wide truncate hidden sm:block min-w-0">{envVar}</code>
                <div className="flex-1" />
                <div className="shrink-0">{statusNode}</div>
                <div className="shrink-0">
                    {serverConfigured ? (
                        <span title="Set via server environment" className="text-gray-300 cursor-default">
                            <Lock className="h-3.5 w-3.5" />
                        </span>
                    ) : configured && !expanded ? (
                        <span className="flex items-center gap-3">
                            <button type="button" onClick={() => setExpanded(true)} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Replace</button>
                            <button type="button" onClick={handleRemove} disabled={saving} className="text-xs text-gray-300 hover:text-gray-600 transition-colors">Remove</button>
                        </span>
                    ) : !configured && !expanded ? (
                        <button type="button" onClick={() => setExpanded(true)} className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2 py-0.5 transition-colors">Add key</button>
                    ) : null}
                </div>
            </div>

            {expanded && !serverConfigured && (
                <div className="mt-2 flex items-center gap-2">
                    <div className="relative flex-1">
                        <input
                            type={reveal ? "text" : "password"}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setValue(""); setExpanded(false); } }}
                            placeholder={placeholder}
                            autoFocus autoComplete="off" spellCheck={false}
                            className="w-full h-8 rounded-md border border-gray-200 bg-white pl-3 pr-8 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black/10"
                        />
                        <button type="button" onClick={() => setReveal((r) => !r)} className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600" tabIndex={-1}>
                            {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                    </div>
                    <button type="button" onClick={handleSave} disabled={!dirty || saving} className="h-8 px-3 rounded-md bg-gray-900 text-white text-xs font-medium disabled:opacity-40 hover:bg-gray-700 transition-colors flex items-center gap-1.5">
                        {justSaved ? <Check className="h-3.5 w-3.5" /> : saving ? "…" : "Save"}
                    </button>
                    <button type="button" onClick={() => { setValue(""); setExpanded(false); }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Catalog table (copied from models page)
// ---------------------------------------------------------------------------

function CatalogTable({
    models, enabledModels, favoriteModels, onToggleEnabled, onToggleFavorite,
}: {
    models: CatalogModel[];
    enabledModels: string[];
    favoriteModels: string[];
    onToggleEnabled: (qualifiedId: string) => Promise<void>;
    onToggleFavorite: (qualifiedId: string) => Promise<void>;
}) {
    return (
        <div className="rounded-xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <colgroup>
                    <col style={{ width: "32px" }} />
                    <col style={{ width: "28px" }} />
                    <col style={{ minWidth: "120px" }} />
                    <col style={{ width: "100px" }} />
                    <col className="hidden sm:table-column" style={{ width: "54px" }} />
                    <col className="hidden sm:table-column" style={{ width: "64px" }} />
                    <col className="hidden sm:table-column" style={{ width: "72px" }} />
                </colgroup>
                <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="px-2 py-2 font-medium text-gray-400 text-xs uppercase tracking-wide text-center" title="Enable">On</th>
                        <th className="px-2 py-2 font-medium text-gray-400 text-xs uppercase tracking-wide text-center" title="Favorite">Fav</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-400 text-xs uppercase tracking-wide">Model</th>
                        <th className="px-2 py-2 font-medium text-gray-400 text-xs uppercase tracking-wide text-center">Cap.</th>
                        <th className="hidden sm:table-cell text-right px-3 py-2 font-medium text-gray-400 text-xs uppercase tracking-wide" title="Context window">CTX</th>
                        <th className="hidden sm:table-cell text-right px-3 py-2 font-medium text-gray-400 text-xs uppercase tracking-wide" title="Input price per million tokens">IN/M</th>
                        <th className="hidden sm:table-cell text-right px-3 py-2 font-medium text-gray-400 text-xs uppercase tracking-wide" title="Output price per million tokens">OUT/M</th>
                    </tr>
                </thead>
                <tbody>
                    {models.map((m) => {
                        const qid = `${m.provider}:${m.id}`;
                        const enabled = enabledModels.includes(qid);
                        const favorite = favoriteModels.includes(qid);
                        return (
                            <tr key={qid} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                                <td className="px-2 py-2 text-center">
                                    <button type="button" onClick={() => onToggleEnabled(qid)} className="flex items-center justify-center w-full">
                                        <span className={`inline-block w-3 h-3 rounded-full border-2 transition-colors ${enabled ? "bg-gray-400 border-gray-400" : "bg-transparent border-gray-300 hover:border-gray-400"}`} />
                                    </button>
                                </td>
                                <td className="px-2 py-2 text-center">
                                    <button type="button" onClick={() => onToggleFavorite(qid)}>
                                        <Star className={`h-3.5 w-3.5 ${favorite ? "fill-gray-400 text-gray-400" : "text-gray-200 hover:text-gray-400"}`} />
                                    </button>
                                </td>
                                <td className="px-3 py-2 overflow-hidden">
                                    <div className="flex items-baseline gap-2 min-w-0">
                                        <span className={`font-medium text-sm whitespace-nowrap ${enabled ? "text-gray-900" : "text-gray-400"}`}>{m.display_name}</span>
                                        <span className="hidden sm:block text-[11px] text-gray-300 font-mono truncate min-w-0" title={m.id}>{m.id}</span>
                                    </div>
                                </td>
                                <td className="px-2 py-2">
                                    <div className="flex items-center justify-center gap-1">
                                        <CapIcon type="tools" active={!!m.supports_tools} />
                                        <CapIcon type="images" active={!!m.supports_images} />
                                        <CapIcon type="pdf" active={!!m.supports_pdf} />
                                        <CapIcon type="reasoning" active={!!m.supports_reasoning} />
                                        <CapIcon type="zdr" active={!!m.zdr} />
                                    </div>
                                </td>
                                <td className="hidden sm:table-cell px-3 py-2 text-right text-gray-400 text-xs font-mono">
                                    {m.context_window ? formatK(m.context_window) : "—"}
                                </td>
                                <td className="hidden sm:table-cell px-3 py-2 text-right text-xs font-mono">
                                    <span className={m.input_price_per_m != null ? "text-gray-500" : "text-gray-200"}>
                                        {m.input_price_per_m != null ? `$${m.input_price_per_m.toFixed(2)}` : "—"}
                                    </span>
                                </td>
                                <td className="hidden sm:table-cell px-3 py-2 text-right text-xs font-mono">
                                    <span className={m.output_price_per_m != null ? "text-gray-500" : "text-gray-200"}>
                                        {m.output_price_per_m != null ? `$${m.output_price_per_m.toFixed(2)}` : "—"}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            </div>
        </div>
    );
}

function formatK(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return String(n);
}

function CapIcon({ type, active }: { type: "tools" | "images" | "pdf" | "reasoning" | "zdr"; active: boolean }) {
    const size = "w-4 h-4 shrink-0";
    const LABELS = {
        tools:     { active: "Tool use", inactive: "No tool use" },
        images:    { active: "Vision", inactive: "No vision" },
        pdf:       { active: "PDF input", inactive: "No PDF" },
        reasoning: { active: "Extended reasoning", inactive: "No reasoning" },
        zdr:       { active: "Zero Data Retention", inactive: "No ZDR" },
    };
    const label = active ? LABELS[type].active : LABELS[type].inactive;

    if (type === "tools") {
        return <span title={label}><svg className={active ? `${size} text-gray-500` : `${size} text-gray-200`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 13L10 6M13 3a2 2 0 01-3 3L6 10l-3 1 1-3 4-4a2 2 0 013-3z" strokeLinecap="round" strokeLinejoin="round"/></svg></span>;
    }
    if (type === "images") {
        return <span title={label}><svg className={active ? `${size} text-gray-500` : `${size} text-gray-200`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><circle cx="5.5" cy="6" r="1.25"/><path d="M1.5 11l3.5-3.5 2.5 2.5 2-2 4 4" strokeLinecap="round" strokeLinejoin="round"/></svg></span>;
    }
    if (type === "pdf") {
        return <span title={label}><svg className={active ? `${size} text-gray-500` : `${size} text-gray-200`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 1.5H4a1 1 0 00-1 1v11a1 1 0 001 1h8a1 1 0 001-1V6L9 1.5z" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 1.5V6h4.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 9.5h6M5 11.5h4" strokeLinecap="round"/></svg></span>;
    }
    if (type === "reasoning") {
        return <span title={label}><svg className={active ? `${size} text-gray-500` : `${size} text-gray-200`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 1.5a4.5 4.5 0 014.5 4.5c0 1.8-1 3.3-2.5 4.1V11.5a1 1 0 01-1 1h-2a1 1 0 01-1-1v-1.4A4.5 4.5 0 018 1.5z" strokeLinecap="round" strokeLinejoin="round"/><path d="M6.5 14.5h3" strokeLinecap="round"/></svg></span>;
    }
    // ZDR
    if (active) {
        return <span title={label}><svg className={`${size} text-gray-500`} viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L2 3.5v5C2 11.8 4.7 14.5 8 15.5c3.3-1 6-3.7 6-7V3.5L8 1z"/><path d="M5.5 8l1.8 1.8L10.5 6.5" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></span>;
    }
    return <span title={label}><svg className={`${size} text-gray-200`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 1L2 3.5v5C2 11.8 4.7 14.5 8 15.5c3.3-1 6-3.7 6-7V3.5L8 1z" strokeLinecap="round" strokeLinejoin="round"/></svg></span>;
}
