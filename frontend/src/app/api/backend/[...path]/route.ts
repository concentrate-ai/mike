import { type NextRequest, NextResponse } from "next/server";

const BACKEND_INTERNAL = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:3001";

async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    const url = `${BACKEND_INTERNAL}/${path.join("/")}${req.nextUrl.search}`;

    const headers = new Headers(req.headers);
    headers.delete("host");

    const body = req.method !== "GET" && req.method !== "HEAD"
        ? await req.arrayBuffer()
        : undefined;

    const upstream = await fetch(url, {
        method: req.method,
        headers,
        body: body ? body : undefined,
        redirect: "manual",
        // @ts-expect-error — Node fetch supports duplex for streaming
        duplex: "half",
    });

    return new NextResponse(upstream.body, {
        status: upstream.status,
        headers: upstream.headers,
    });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
