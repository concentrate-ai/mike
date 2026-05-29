import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    reactCompiler: true,
    // Standalone output is only needed for the Docker image (bundles everything
    // needed to run without node_modules). Set NEXT_OUTPUT=standalone in the
    // Docker build to enable it — otherwise it stays default, which is
    // compatible with Vercel, Cloudflare Pages, and local development.
    ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" } : {}),
    async rewrites() {
        return [
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
