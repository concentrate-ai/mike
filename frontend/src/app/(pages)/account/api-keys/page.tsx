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
        description: "Routes to Anthropic, Google, OpenAI, DeepSeek, Llama, Mistral & 100+ models.",
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
                    Mike speaks directly to each provider. Add a key to enable its models.
                    The Models page only shows providers you have configured.
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
                        description={"description" in p ? p.description : undefined}
                        link={"link" in p ? p.link : undefined}
                        configured={!!profile?.apiKeys[p.provider]?.configured}
                        serverConfigured={profile?.apiKeys[p.provider]?.source === "env"}
                        onSave={(value) => updateApiKey(p.provider, value || null)}
                        onRemove={() => updateApiKey(p.provider, null)}
                    />
                ))}
            </div>
        </div>
    );
}

function ProviderRow({
    provider,
    label,
    envVar,
    placeholder,
    description,
    link,
    configured,
    serverConfigured,
    onSave,
    onRemove,
}: {
    provider: ApiKeyProvider;
    label: string;
    envVar: string;
    placeholder: string;
    description?: string;
    link?: string;
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

    // Status indicator
    let statusNode: React.ReactNode = null;
    if (verifying) {
        statusNode = (
            <span className="text-xs text-gray-400 animate-pulse">checking…</span>
        );
    } else if (verified === true) {
        statusNode = (
            <span
                title="We checked the API and the key is valid"
                className="flex items-center gap-1 text-xs text-green-600 cursor-default"
            >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Verified</span>
            </span>
        );
    } else if (verified === false) {
        statusNode = (
            <span
                title="Key check failed — the API returned an auth error"
                className="flex items-center gap-1 text-xs text-red-500 cursor-default"
            >
                <XCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Invalid</span>
            </span>
        );
    }

    return (
        <div className="px-4 py-3">
            {/* Top row: label + env var + status + actions */}
            <div className="flex items-center gap-3 min-w-0">
                {/* Provider name */}
                <span className="text-sm font-medium text-gray-900 w-24 shrink-0">
                    {label}
                </span>

                {/* Env var chip */}
                <code className="text-[11px] text-gray-400 font-mono hidden sm:block shrink-0">
                    {envVar}
                </code>

                <div className="flex-1" />

                {/* Status */}
                {statusNode && <div className="shrink-0">{statusNode}</div>}

                {/* Lock icon for server-configured */}
                {serverConfigured && (
                    <span
                        title="Set via server .env — to change it, update the environment variable and redeploy"
                        className="text-gray-300 shrink-0 cursor-default"
                    >
                        <Lock className="h-3.5 w-3.5" />
                    </span>
                )}

                {/* Edit / remove actions */}
                {!serverConfigured && (
                    <>
                        {configured && !expanded && (
                            <button
                                type="button"
                                onClick={() => setExpanded(true)}
                                className="text-xs text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                            >
                                Replace
                            </button>
                        )}
                        {configured && !expanded && (
                            <button
                                type="button"
                                onClick={handleRemove}
                                disabled={saving}
                                className="text-xs text-gray-300 hover:text-red-400 transition-colors shrink-0"
                            >
                                Remove
                            </button>
                        )}
                        {!configured && !expanded && (
                            <button
                                type="button"
                                onClick={() => setExpanded(true)}
                                className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded px-2 py-0.5 transition-colors shrink-0"
                            >
                                Add key
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* Description (Concentrate only) */}
            {description && (
                <p className="text-xs text-gray-400 mt-0.5 ml-0">
                    {description}
                    {link && (
                        <>
                            {" "}
                            <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline hover:text-gray-600"
                            >
                                {link.replace(/^https?:\/\//, "")}
                            </a>
                        </>
                    )}
                </p>
            )}

            {/* Inline input (expands when editing) */}
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
                            className="w-full h-8 rounded-md border border-gray-300 bg-white pl-3 pr-8 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black/10"
                        />
                        <button
                            type="button"
                            onClick={() => setReveal((r) => !r)}
                            className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600"
                            tabIndex={-1}
                        >
                            {reveal ? (
                                <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                                <Eye className="h-3.5 w-3.5" />
                            )}
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!dirty || saving}
                        className="h-8 px-3 rounded-md bg-gray-900 text-white text-xs font-medium disabled:opacity-40 hover:bg-gray-700 transition-colors flex items-center gap-1.5"
                    >
                        {justSaved ? (
                            <Check className="h-3.5 w-3.5" />
                        ) : saving ? (
                            "…"
                        ) : (
                            "Save"
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => { setValue(""); setExpanded(false); }}
                        className="text-xs text-gray-400 hover:text-gray-600"
                    >
                        Cancel
                    </button>
                </div>
            )}
        </div>
    );
}
