"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/contexts/UserProfileContext";

const PROVIDERS: { id: string; label: string; apiKey: string }[] = [
    { id: "anthropic", label: "Anthropic", apiKey: "claude" },
    { id: "concentrate", label: "Concentrate", apiKey: "concentrate" },
    { id: "google", label: "Google", apiKey: "gemini" },
    { id: "openai", label: "OpenAI", apiKey: "openai" },
];

interface NavItem {
    id: string;
    label: string;
    href: string;
    indent?: boolean;
    dot?: boolean;
    mobileHide?: boolean; // hide on mobile (section headers)
}

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
        { id: "providers-header", label: "Providers", href: "/account/providers", mobileHide: true },
        ...PROVIDERS.map((p) => ({
            id: p.id,
            label: p.label,
            href: `/account/providers/${p.id}`,
            indent: true,
            dot: !!profile?.apiKeys[p.apiKey as keyof typeof profile.apiKeys]?.configured,
        })),
        { id: "preferences", label: "Preferences", href: "/account/preferences" },
    ];

    return (
        <div className="flex h-full flex-col overflow-y-auto">
            <header className="mx-auto flex h-14 w-full max-w-5xl shrink-0 items-end px-4 pb-2 md:h-24 md:px-6 md:pb-4">
                <h1 className="text-3xl md:text-4xl font-medium font-eb-garamond">Settings</h1>
            </header>

            <main className="mx-auto w-full max-w-5xl flex-1 px-4 md:px-6 pb-10 pt-2 md:pt-6">
                <div className="grid grid-cols-1 gap-y-4 md:grid-cols-[224px_minmax(0,1fr)] md:gap-x-10">

                    {/* Navigation */}
                    <nav aria-label="Settings" className="z-10 min-w-0 self-start md:sticky md:top-4">
                        {/* Mobile: horizontal scrolling pill nav */}
                        <div className="md:hidden -mx-4 px-4 overflow-x-auto pb-1">
                            <ul className="flex gap-1 min-w-max">
                                {navItems
                                    .filter((item) => !item.mobileHide)
                                    .map((item) => {
                                        const active =
                                            item.href === "/account"
                                                ? pathname === "/account"
                                                : pathname === item.href || pathname.startsWith(item.href + "/");
                                        return (
                                            <li key={item.id}>
                                                <button
                                                    type="button"
                                                    aria-current={active ? "page" : undefined}
                                                    onClick={() => router.push(item.href)}
                                                    className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm whitespace-nowrap transition-colors font-medium ${
                                                        active
                                                            ? "bg-gray-900 text-white"
                                                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                    }`}
                                                >
                                                    {item.dot !== undefined && (
                                                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${item.dot ? "bg-current" : "bg-gray-400"}`} />
                                                    )}
                                                    {item.label}
                                                </button>
                                            </li>
                                        );
                                    })}
                            </ul>
                        </div>

                        {/* Desktop: vertical list */}
                        <ul className="hidden md:flex md:flex-col gap-1">
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
                                            className={`flex w-full items-center rounded-lg text-left text-sm whitespace-nowrap transition-colors
                                                ${item.indent ? "pl-6 pr-3 h-9" : "px-3 h-9"}
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
                    </nav>

                    <div className="min-w-0 outline-none">{children}</div>
                </div>
            </main>
        </div>
    );
}
