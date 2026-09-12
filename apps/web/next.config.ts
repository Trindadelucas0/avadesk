import type { NextConfig } from "next";
import path from "node:path";
import { config as loadDotenv } from "dotenv";

// Prefer monorepo root .env, then apps/web/.env.local (Next also loads local files)
loadDotenv({ path: path.resolve(__dirname, "../../.env") });
loadDotenv({ path: path.resolve(__dirname, ".env.local"), override: true });

const apiOrigin =
  process.env.API_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:4000";

const nextConfig: NextConfig = {
  // Monorepo: resolve React from root node_modules (workspaces)
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // Allow isolated prod build while `next dev` holds `.next`
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: `${apiOrigin}/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
