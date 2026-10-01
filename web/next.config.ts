import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Next.js from trying to bundle native C++ addons
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
