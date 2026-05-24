"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_MODEL_ID } from "@/app/lib/models";

const STORAGE_KEY = "mike.selectedModel";

function firstId(dynamicIds?: Set<string>): string {
    if (dynamicIds && dynamicIds.size > 0) return dynamicIds.values().next().value as string;
    return DEFAULT_MODEL_ID;
}

function readStored(dynamicIds?: Set<string>): string {
    if (typeof window === "undefined") return firstId(dynamicIds);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return firstId(dynamicIds);

    // Accept the stored value if it's in the enabled set (qualified or bare)
    if (dynamicIds?.has(raw)) return raw;

    // Legacy bare id — see if a qualified version exists in the enabled set
    if (!raw.includes(":") && dynamicIds) {
        for (const id of dynamicIds) {
            if (id.endsWith(`:${raw}`)) return id;
        }
    }

    return firstId(dynamicIds);
}

export function useSelectedModel(dynamicIds?: Set<string>): [string, (id: string) => void] {
    const [model, setModelState] = useState<string>(() => firstId(dynamicIds));

    useEffect(() => {
        setModelState(readStored(dynamicIds));
    }, [dynamicIds]);

    const setModel = useCallback((id: string) => {
        setModelState(id);
        if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, id);
        }
    }, []);

    return [model, setModel];
}
