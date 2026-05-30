"use client";

import { useEffect, useState } from "react";
import { Check, CheckCircle2, Eye, EyeOff, Lock, XCircle } from "lucide-react";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { verifyApiKey as verifyApiKeyRequest } from "@/app/lib/mikeApi";
import type { ApiKeyProvider } from "@/app/lib/mikeApi";

const PROVIDERS = [
    {
        provider: "concentrate" as const,
        label: "Concentrate",
        envVar: "CONCENTRATE_API_KEY",
        placeholder: "sk-cn-…",
        description: "Routes to 100+ models. Mike uses Zero Data Retention (ZDR) models only — your data is never used for training.",
        link: "https://concentrate.ai",
    },
    {
        provider: "claude" as const,
        label: "Anthropic",
        envVar: "ANTHROPIC_API_KEY",
        placeholder: "sk-ant-…",
    },
    {
        provider: "gemini" as const,
        label: "Google",
        envVar: "GEMINI_API_KEY",
        placeholder: "AIza…",
    },
    {
        provider: "openai" as const,
        label: "OpenAI",
        envVar: "OPENAI_API_KEY",
        placeholder: "sk-…",
    },
] as const;

export default function ApiKeysPage() {
    const { profile, updateApiKey } = useUserProfile();

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h2 className="text-2xl font-medium font-serif">Providers</h2>
                <p className="text-sm text-gray-400 mt-1">
                    Add a key to enable a provider. The Models page only shows providers you have configured.
                </p>
            </div>

            <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                {PROVIDERS.map((p) => (
                    <ProviderRow
                        key={p.provider}
                        provider={p.provider}
                        label={p.label}
                        envVar={p.envVar}
                        placeholder={p.placeholder}
                        configured={!!profile?.apiKeys[p.provider]?.configured}
                        serverConfigured={profile?.apiKeys[p.provider]?.source === "env"}
                        onSave={(value) => updateApiKey(p.provider, value || null)}
                        onRemove={() => updateApiKey(p.provider, null)}
                    />
                ))}
            </div>

            {/* Concentrate footnote — outside the card so rows stay uniform height */}
            <p className="text-xs text-gray-400 leading-relaxed">
                Concentrate routes to 100+ models via a single key. Mike uses{" "}
                <span className="text-gray-500 font-medium">Zero Data Retention (ZDR)</span>{" "}
                models only — your data is never used for training.{" "}
                <a href="https://concentrate.ai" target="_blank" rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-gray-600 transition-colors">
                    concentrate.ai
                </a>
            </p>
        </div>
    );
}

function ProviderRow({
    provider,
    label,
    envVar,
    placeholder,
    configured,
    serverConfigured,
    onSave,
    onRemove,
}: {
    provider: ApiKeyProvider;
    label: string;
    envVar: string;
    placeholder: string;
    configured: boolean;
    serverConfigured: boolean;
    onSave: (value: string) => Promise<boolean>;
    onRemove: () => Promise<boolean>;
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
            const ok = await verifyApiKeyRequest(provider);
            setVerified(ok);
        } catch {
            setVerified(false);
        } finally {
            setVerifying(false);
        }
    };

    useEffect(() => {
        setValue("");
        if (configured || serverConfigured) {
            runVerify();
        } else {
            setVerified(null);
        }
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
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") handleSave();
        if (e.key === "Escape") {
            setValue("");
            setExpanded(false);
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
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>Verified</span>
            </span>
        );
    } else if (verified === false) {
        statusNode = (
            <span title="Key check failed" className="flex items-center gap-1 text-xs text-gray-700 cursor-default">
                <XCircle className="h-3.5 w-3.5 shrink-0" />
                <span>Invalid</span>
            </span>
        );
    }

    // Actions column content — fixed width so all rows align
    let actionsNode: React.ReactNode = null;
    if (serverConfigured) {
        actionsNode = (
            <span title="Set via server environment — update the variable and redeploy to change" className="text-gray-300 cursor-default">
                <Lock className="h-3.5 w-3.5" />
            </span>
        );
    } else if (configured && !expanded) {
        actionsNode = (
            <span className="flex items-center gap-3">
                <button type="button" onClick={() => setExpanded(true)}
                    className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                    Replace
                </button>
                <button type="button" onClick={handleRemove} disabled={saving}
                    className="text-xs text-gray-300 hover:text-gray-600 transition-colors">
                    Remove
                </button>
            </span>
        );
    } else if (!configured && !expanded) {
        actionsNode = (
            <button type="button" onClick={() => setExpanded(true)}
                className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2 py-0.5 transition-colors">
                Add key
            </button>
        );
    }

    return (
        <div className="px-4 py-3">
            {/*
              Grid: [label 120px] [env var 1fr] [status 96px] [actions 120px]
              Every row uses the same grid so columns lock across all providers.
            */}
            <div className="grid items-center gap-x-4"
                style={{ gridTemplateColumns: "120px 1fr 96px 120px" }}>

                {/* Col 1: provider name */}
                <span className="text-sm font-medium text-gray-900 truncate">
                    {label}
                </span>

                {/* Col 2: env var */}
                <code className="text-[11px] text-gray-300 font-mono tracking-wide truncate">
                    {envVar}
                </code>

                {/* Col 3: status — right-aligned within its column */}
                <div className="flex justify-end">
                    {statusNode}
                </div>

                {/* Col 4: actions — right-aligned */}
                <div className="flex justify-end">
                    {actionsNode}
                </div>
            </div>

            {/* Inline key input */}
            {expanded && !serverConfigured && (
                <div className="mt-2 flex items-center gap-2">
                    <div className="relative flex-1">
                        <input
                            type={reveal ? "text" : "password"}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder}
                            autoFocus
                            autoComplete="off"
                            spellCheck={false}
                            className="w-full h-8 rounded-md border border-gray-200 bg-white pl-3 pr-8 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black/10"
                        />
                        <button type="button" onClick={() => setReveal((r) => !r)}
                            className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600"
                            tabIndex={-1}>
                            {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                    </div>
                    <button type="button" onClick={handleSave} disabled={!dirty || saving}
                        className="h-8 px-3 rounded-md bg-gray-900 text-white text-xs font-medium disabled:opacity-40 hover:bg-gray-700 transition-colors flex items-center gap-1.5">
                        {justSaved ? <Check className="h-3.5 w-3.5" /> : saving ? "…" : "Save"}
                    </button>
                    <button type="button" onClick={() => { setValue(""); setExpanded(false); }}
                        className="text-xs text-gray-400 hover:text-gray-600">
                        Cancel
                    </button>
                </div>
            )}
        </div>
    );
}
