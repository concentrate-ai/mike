"use client";

import { useRouter } from "next/navigation";

const PROVIDERS = [
    { id: "anthropic", label: "Anthropic" },
    { id: "concentrate", label: "Concentrate" },
    { id: "google", label: "Google" },
    { id: "openai", label: "OpenAI" },
];

export default function ProvidersIndexPage() {
    const router = useRouter();
    return (
        <div className="space-y-4 max-w-2xl">
            <div>
                <h2 className="text-2xl font-medium font-serif">Providers</h2>
                <p className="text-sm text-gray-400 mt-1">Select a provider to add a key and manage its models.</p>
            </div>
            <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                {PROVIDERS.map((p) => (
                    <button
                        key={p.id}
                        type="button"
                        onClick={() => router.push(`/account/providers/${p.id}`)}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm text-left hover:bg-gray-50 transition-colors first:rounded-t-xl last:rounded-b-xl"
                    >
                        <span className="font-medium text-gray-900">{p.label}</span>
                        <span className="text-gray-300">›</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
