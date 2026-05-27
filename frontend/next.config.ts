import type { NextConfig } from "next";

// Internal service URLs — only resolved server-side by Next.js rewrites.
// Never exposed to the browser. Override in .env.local if services run
// on non-default ports.
const BACKEND_INTERNAL_URL = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4001";

const nextConfig: NextConfig = {
    reactCompiler: true,
    async rewrites() {
        return [
            // Proxy the Express backend. Browser calls /api/backend/... and
            // Next.js forwards server-to-server over localhost — the backend
            // port never needs to be reachable from the public internet.
            {
                source: "/api/backend/:path*",
                destination: `${BACKEND_INTERNAL_URL}/:path*`,
            },
            {
                source: "/sitemap.xml",
                destination: "/api/sitemap/sitemap.xml",
            },
            {
                source: "/sitemap_:slug.xml",
                destination: "/api/sitemap/sitemap_:slug.xml",
            },
        ];
    },
    skipTrailingSlashRedirect: true,
};

export default nextConfig;
