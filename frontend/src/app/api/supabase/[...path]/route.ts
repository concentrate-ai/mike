import { type NextRequest, NextResponse } from "next/server";

const SUPABASE_INTERNAL = process.env.SUPABASE_INTERNAL_URL ?? "http://localhost:54321";

async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    const url = `${SUPABASE_INTERNAL}/${path.join("/")}${req.nextUrl.search}`;

    const headers = new Headers(req.headers);
    // Remove headers that shouldn't be forwarded
    headers.delete("host");

    const body = req.method !== "GET" && req.method !== "HEAD"
        ? await req.arrayBuffer()
        : undefined;

    const upstream = await fetch(url, {
        method: req.method,
        headers,
        body: body ? body : undefined,
        // Don't follow redirects — pass them back to the client
        redirect: "manual",
    });

    const resHeaders = new Headers(upstream.headers);
    // Rewrite any absolute Location headers back through the proxy path
    const location = resHeaders.get("location");
    if (location?.startsWith(SUPABASE_INTERNAL)) {
        resHeaders.set("location", location.replace(SUPABASE_INTERNAL, "/api/supabase"));
    }

    return new NextResponse(upstream.body, {
        status: upstream.status,
        headers: resHeaders,
    });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
