"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/contexts/UserProfileContext";

interface NavItem {
    id: string;
    label: string;
    href: string;
    indent?: boolean;
    dot?: boolean;
}

const PROVIDERS: { id: string; label: string; apiKey: string }[] = [
    { id: "anthropic", label: "Anthropic", apiKey: "claude" },
    { id: "concentrate", label: "Concentrate", apiKey: "concentrate" },
    { id: "google", label: "Google", apiKey: "gemini" },
    { id: "openai", label: "OpenAI", apiKey: "openai" },
];

export default function AccountLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const { isAuthenticated, authLoading } = useAuth();
    const { profile } = useUserProfile();

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push("/");
        }
    }, [isAuthenticated, authLoading, router]);

    if (authLoading) {
        return (
            <div className="h-dvh bg-white flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    if (!isAuthenticated) return null;

    const navItems: NavItem[] = [
        { id: "general", label: "General", href: "/account" },
        { id: "providers-header", label: "Providers", href: "/account/providers" },
        ...PROVIDERS.map((p) => ({
            id: p.id,
            label: p.label,
            href: `/account/providers/${p.id}`,
            indent: true,
            dot: !!profile?.apiKeys[p.apiKey as keyof typeof profile.apiKeys]?.configured,
        })),
        { id: "preferences", label: "Model Preferences", href: "/account/preferences" },
    ];

    return (
        <div className="flex h-full flex-col overflow-y-auto">
            <header className="mx-auto flex h-16 w-full max-w-5xl shrink-0 items-end px-6 pb-2 md:h-24 md:pb-4">
                <h1 className="text-4xl font-medium font-eb-garamond">Settings</h1>
            </header>

            <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-10 pt-4 md:pt-6">
                <div className="grid grid-cols-1 gap-y-6 md:grid-cols-[224px_minmax(0,1fr)] md:gap-x-10">
                    <nav aria-label="Settings" className="z-10 -ml-3 min-w-0 self-start md:sticky md:top-4">
                        <div className="-m-1 min-w-0 p-1">
                            <div className="-m-1 min-w-0 overflow-x-auto overflow-y-hidden p-1">
                                <ul className="mb-0 flex gap-1 md:flex-col">
                                    {navItems.map((item) => {
                                        const active =
                                            item.href === "/account"
                                                ? pathname === "/account"
                                                : pathname === item.href || pathname.startsWith(item.href + "/");
                                        const isHeader = item.id === "providers-header";
                                        return (
                                            <li key={item.id}>
                                                <button
                                                    type="button"
                                                    aria-current={active ? "page" : undefined}
                                                    onClick={() => !isHeader && router.push(item.href)}
                                                    className={`flex h-9 w-full items-center rounded-lg text-left text-sm whitespace-nowrap transition-colors
                                                        ${item.indent ? "pl-6 pr-3" : "px-3"}
                                                        ${isHeader ? "font-medium text-gray-400 cursor-default text-xs uppercase tracking-wide h-7" : "font-medium"}
                                                        ${active && !isHeader ? "bg-gray-100 text-gray-900" : !isHeader ? "text-gray-500 hover:bg-gray-50 hover:text-gray-900" : ""}
                                                    `}
                                                >
                                                    {item.indent && (
                                                        <span className={`mr-2 h-1.5 w-1.5 rounded-full shrink-0 ${item.dot ? "bg-gray-400" : "bg-gray-200"}`} />
                                                    )}
                                                    {item.label}
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        </div>
                    </nav>

                    <div className="min-w-0 outline-none">{children}</div>
                </div>
            </main>
        </div>
    );
}
