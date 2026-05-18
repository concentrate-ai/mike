import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import type { ApiKeyProvider } from "./userApiKeys";

const TIMEOUT_MS = 5000;

async function withTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
        promise,
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS),
        ),
    ]);
}

async function verifyClaude(key: string): Promise<boolean> {
    const client = new Anthropic({ apiKey: key });
    await withTimeout(client.models.list({ limit: 1 }));
    return true;
}

async function verifyGemini(key: string): Promise<boolean> {
    const client = new GoogleGenAI({ apiKey: key });
    await withTimeout(client.models.get({ model: "gemini-2.0-flash" }));
    return true;
}

async function verifyOpenAI(key: string): Promise<boolean> {
    const res = await withTimeout(
        fetch("https://api.openai.com/v1/models?limit=1", {
            headers: { Authorization: `Bearer ${key}` },
        }),
    );
    return res.ok;
}

async function verifyConcentrate(key: string): Promise<boolean> {
    const res = await withTimeout(
        fetch("https://api.concentrate.ai/v1/models", {
            headers: { Authorization: `Bearer ${key}` },
        }),
    );
    return res.ok;
}

export async function verifyApiKey(
    provider: ApiKeyProvider,
    key: string,
): Promise<boolean> {
    if (!key.trim()) return false;
    try {
        switch (provider) {
            case "claude":
                return await verifyClaude(key);
            case "gemini":
                return await verifyGemini(key);
            case "openai":
                return await verifyOpenAI(key);
            case "concentrate":
                return await verifyConcentrate(key);
            default:
                return false;
        }
    } catch {
        return false;
    }
}
