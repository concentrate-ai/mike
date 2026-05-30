"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ModelsRedirect() {
    const router = useRouter();
    useEffect(() => { router.replace("/account/providers/concentrate"); }, [router]);
    return null;
}
