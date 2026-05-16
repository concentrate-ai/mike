"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_MODEL_ID, isAllowedModelId } from "@/app/lib/models";

const STORAGE_KEY = "mike.selectedModel";

function readStored(dynamicIds?: Set<string>): string {
    if (typeof window === "undefined") return DEFAULT_MODEL_ID;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && isAllowedModelId(raw, dynamicIds)) return raw;
    return DEFAULT_MODEL_ID;
}

export function useSelectedModel(dynamicIds?: Set<string>): [string, (id: string) => void] {
    const [model, setModelState] = useState<string>(DEFAULT_MODEL_ID);

    useEffect(() => {
        setModelState(readStored(dynamicIds));
    }, [dynamicIds]);

    const setModel = useCallback((id: string) => {
        const next = isAllowedModelId(id, dynamicIds) ? id : DEFAULT_MODEL_ID;
        setModelState(next);
        if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, next);
        }
    }, [dynamicIds]);

    return [model, setModel];
}
