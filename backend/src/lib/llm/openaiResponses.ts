/**
 * Shared adapter for OpenAI Responses-API-compatible providers.
 *
 * The Responses API ({{ POST /v1/responses, SSE stream events like
 * response.output_text.delta }}) is implemented by OpenAI itself and by a
 * growing list of compatible routers: Concentrate, OpenRouter, LiteLLM in
 * Responses mode, vLLM with the OpenAI shim, Ollama via its OpenAI-compat
 * proxy, etc. They differ only in base URL, auth header, and small
 * idiosyncrasies of which event type carries reasoning deltas.
 *
 * makeOpenAIResponsesAdapter returns a {stream, complete} pair bound to a
 * specific provider instance. The per-instance arguments (baseUrl, apiKey
 * resolver, label, apiKeysField) capture everything provider-specific.
 *
 * To add a new compatible provider:
 *   1. Add an entry to backend/src/lib/llm/providers.ts.
 *   2. Pass that entry's baseUrl + envKey + apiKeysField to this factory.
 * No edits to streaming, tool-call, or SSE parsing logic should be required.
 */
import type {
    LlmMessage,
    NormalizedToolCall,
    NormalizedToolResult,
    OpenAIToolSchema,
    StreamChatParams,
    StreamChatResult,
    UserApiKeys,
} from "./types";

const MAX_OUTPUT_TOKENS = 16384;

type ResponseInputItem =
    | { role: "user" | "assistant"; content: string }
    | { type: "function_call"; call_id: string; name: string; arguments: string }
    | { type: "function_call_output"; call_id: string; output: string };

type ResponseFunctionTool = {
    type: "function";
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
};

type ResponseFunctionCallItem = {
    type: "function_call";
    call_id?: string;
    name?: string;
    arguments?: string;
};

type ResponseStreamEvent = {
    type?: string;
    delta?: string;
    response?: { id?: string; output_text?: string };
    item?: ResponseFunctionCallItem;
};

export interface OpenAIResponsesAdapterConfig {
    /**
     * Provider id key into UserApiKeys (e.g. "openai", "concentrate"). Used
     * to read the per-user override key. The factory does not enumerate the
     * other providers, so adding a new one only requires extending UserApiKeys
     * in types.ts.
     */
    apiKeysField: keyof UserApiKeys;
    /** Display label used in error messages, e.g. "OpenAI" or "Concentrate". */
    label: string;
    /** Resolve the base URL for /v1/responses at call time (so env overrides apply). */
    resolveBaseUrl: () => string;
    /** Resolve the env-fallback API key at call time. */
    resolveEnvKey: () => string | undefined;
    /** If true, a missing key is not an error (e.g. Ollama with no auth). */
    keyOptional?: boolean;
}

export interface OpenAIResponsesAdapter {
    stream: (params: StreamChatParams) => Promise<StreamChatResult>;
    complete: (params: {
        model: string;
        systemPrompt?: string;
        user: string;
        maxTokens?: number;
        apiKeys?: UserApiKeys;
    }) => Promise<string>;
}

export function makeOpenAIResponsesAdapter(
    config: OpenAIResponsesAdapterConfig,
): OpenAIResponsesAdapter {
    function resolveKey(override?: string | null): string {
        const key = override?.trim() || config.resolveEnvKey()?.trim() || "";
        if (!key && !config.keyOptional) {
            throw new Error(
                `${config.label} API key is not configured. Set the environment variable or add a user key.`,
            );
        }
        return key;
    }

    function toResponseTools(tools: OpenAIToolSchema[]): ResponseFunctionTool[] {
        return tools.map((tool) => ({
            type: "function",
            name: tool.function.name,
            description: tool.function.description,
            parameters: tool.function.parameters,
        }));
    }

    function toResponseInput(messages: LlmMessage[]): ResponseInputItem[] {
        return messages
            .filter((m) => m.content)
            .map((message) => ({
                role: message.role,
                content: message.content,
            }));
    }

    function extractSseJson(buffer: string): {
        events: unknown[];
        rest: string;
    } {
        const events: unknown[] = [];
        const chunks = buffer.split(/\n\n/);
        const rest = chunks.pop() ?? "";

        for (const chunk of chunks) {
            const dataLines = chunk
                .split("\n")
                .map((line) => line.trim())
                .filter((line) => line.startsWith("data:"))
                .map((line) => line.slice(5).trim());

            for (const data of dataLines) {
                if (!data || data === "[DONE]") continue;
                try {
                    events.push(JSON.parse(data));
                } catch {
                    // Incomplete events stay buffered until the next read.
                }
            }
        }

        return { events, rest };
    }

    function parseFunctionCall(
        item: ResponseFunctionCallItem,
    ): NormalizedToolCall {
        let input: Record<string, unknown> = {};
        try {
            const parsed = JSON.parse(item.arguments || "{}");
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                input = parsed as Record<string, unknown>;
            }
        } catch {
            input = {};
        }

        return {
            id: item.call_id ?? item.name ?? "function_call",
            name: item.name ?? "",
            input,
        };
    }

    async function createResponse(params: {
        model: string;
        input: ResponseInputItem[];
        instructions?: string;
        tools?: ResponseFunctionTool[];
        stream?: boolean;
        maxTokens?: number;
        previousResponseId?: string;
        reasoningSummary?: boolean;
        apiKey: string;
    }): Promise<Response> {
        const response = await fetch(config.resolveBaseUrl(), {
            method: "POST",
            headers: {
                Authorization: `Bearer ${params.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: params.model,
                instructions: params.instructions || undefined,
                input: params.input,
                tools: params.tools?.length ? params.tools : undefined,
                stream: params.stream,
                max_output_tokens: params.maxTokens ?? MAX_OUTPUT_TOKENS,
                previous_response_id: params.previousResponseId,
                reasoning: params.reasoningSummary
                    ? { summary: "auto" }
                    : undefined,
            }),
        });

        if (!response.ok) {
            const text = await response.text().catch(() => "");
            const err = new Error(
                `${config.label} request failed (${response.status}): ${text || response.statusText}`,
            );
            (err as { status?: number }).status = response.status;
            throw err;
        }

        return response;
    }

    async function stream(
        params: StreamChatParams,
    ): Promise<StreamChatResult> {
        const {
            model,
            systemPrompt,
            tools = [],
            callbacks = {},
            runTools,
            apiKeys,
            enableThinking,
        } = params;
        const maxIter = params.maxIterations ?? 10;
        const key = resolveKey(apiKeys?.[config.apiKeysField]);
        const responseTools = toResponseTools(tools);
        let input = toResponseInput(params.messages);
        let previousResponseId: string | undefined;
        let fullText = "";
        const hasTools = responseTools.length > 0;

        for (let iter = 0; iter < maxIter; iter++) {
            const response = await createResponse({
                model,
                instructions: iter === 0 ? systemPrompt : undefined,
                input,
                tools: responseTools,
                stream: true,
                previousResponseId,
                reasoningSummary: !!enableThinking,
                apiKey: key,
            });
            if (!response.body) {
                throw new Error(`${config.label} response had no body`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            const toolCalls: NormalizedToolCall[] = [];
            const startedToolCallIds = new Set<string>();
            let buffer = "";
            let pendingText = "";
            let sawReasoning = false;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const extracted = extractSseJson(buffer);
                buffer = extracted.rest;

                for (const event of extracted.events as ResponseStreamEvent[]) {
                    if (event.response?.id) {
                        previousResponseId = event.response.id;
                    }

                    if (
                        (event.type === "response.reasoning_summary_text.delta" ||
                            event.type === "response.reasoning_text.delta") &&
                        typeof event.delta === "string"
                    ) {
                        sawReasoning = true;
                        callbacks.onReasoningDelta?.(event.delta);
                    }

                    if (
                        event.type === "response.output_text.delta" &&
                        typeof event.delta === "string"
                    ) {
                        if (hasTools) {
                            pendingText += event.delta;
                        } else {
                            fullText += event.delta;
                            callbacks.onContentDelta?.(event.delta);
                        }
                    }

                    if (
                        event.type === "response.output_item.added" &&
                        event.item?.type === "function_call"
                    ) {
                        const call = parseFunctionCall(event.item);
                        startedToolCallIds.add(call.id);
                        callbacks.onToolCallStart?.(call);
                    }

                    if (
                        event.type === "response.output_item.done" &&
                        event.item?.type === "function_call"
                    ) {
                        const call = parseFunctionCall(event.item);
                        if (!startedToolCallIds.has(call.id)) {
                            callbacks.onToolCallStart?.(call);
                        }
                        toolCalls.push(call);
                    }
                }
            }

            if (sawReasoning) callbacks.onReasoningBlockEnd?.();

            if (!toolCalls.length || !runTools) {
                if (pendingText) {
                    fullText += pendingText;
                    callbacks.onContentDelta?.(pendingText);
                }
                break;
            }

            const results = await runTools(toolCalls);
            // Carry the full prior input forward, then append the assistant's
            // function_call items and the function_call_output items from the
            // tools we just ran. Without the function_call items, the model
            // loses memory of what it asked for and reasoning becomes
            // incoherent on the next iteration.
            input = [
                ...input,
                ...toolCalls.map(
                    (tc): ResponseInputItem => ({
                        type: "function_call" as const,
                        call_id: tc.id,
                        name: tc.name,
                        arguments: JSON.stringify(tc.input),
                    }),
                ),
                ...results.map(
                    (result): ResponseInputItem => ({
                        type: "function_call_output" as const,
                        call_id: result.tool_use_id,
                        output: result.content,
                    }),
                ),
            ];
            previousResponseId = undefined;
        }

        return { fullText };
    }

    async function complete(params: {
        model: string;
        systemPrompt?: string;
        user: string;
        maxTokens?: number;
        apiKeys?: UserApiKeys;
    }): Promise<string> {
        const response = await createResponse({
            model: params.model,
            instructions: params.systemPrompt,
            input: [{ role: "user", content: params.user }],
            maxTokens: params.maxTokens ?? 512,
            apiKey: resolveKey(params.apiKeys?.[config.apiKeysField]),
        });
        const json = (await response.json()) as {
            output_text?: string;
            output?: {
                content?: { type?: string; text?: string }[];
            }[];
        };

        if (typeof json.output_text === "string") return json.output_text;

        return (
            json.output
                ?.flatMap((item) => item.content ?? [])
                .filter((content) => content.type === "output_text")
                .map((content) => content.text ?? "")
                .join("") ?? ""
        );
    }

    return { stream, complete };
}

export type { NormalizedToolResult };
