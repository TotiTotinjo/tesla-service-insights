import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  // Prefer this project as root when a parent package-lock exists
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
