import type { Provider } from "../../lib/llm/types";

export type CatalogModel = {
    provider: Provider;
    id: string;
    display_name: string;
    description?: string;
    vendor_group?: string;
    context_window?: number;
    max_output_tokens?: number;
    supports_tools?: boolean;
    supports_streaming?: boolean;
    supports_images?: boolean;
    supports_pdf?: boolean;
    supports_reasoning?: boolean;
    supports_json_output?: boolean;
    supports_web_search?: boolean;
    zdr?: boolean;
    input_price_per_m?: number | null;
    output_price_per_m?: number | null;
    is_custom?: boolean;
};
