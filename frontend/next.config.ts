import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    reactCompiler: true,
    // Standalone output bundles everything needed to run without node_modules.
    // Used by the Docker image — see frontend/Dockerfile.
    output: "standalone",
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
