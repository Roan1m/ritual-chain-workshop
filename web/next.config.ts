import type { NextConfig } from "next";

/**
 * Static export for GitHub Pages.
 *
 * A project repo is served from https://<user>.github.io/<repo>/, so the app
 * needs a basePath matching the repo name. It's injected at build time via
 * NEXT_PUBLIC_BASE_PATH (set in .github/workflows/deploy-pages.yml). Local
 * dev/build leave it empty, so the app is served from "/".
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath: basePath || undefined,
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
