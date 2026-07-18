import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // unpdf works in Workers; keep pdfjs optional for local tooling
  serverExternalPackages: ["unpdf", "pdfjs-dist"],
  // Prefer this project as root when a parent package-lock exists
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;

// Enables Cloudflare bindings during local `next dev` (OpenNext)
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();

