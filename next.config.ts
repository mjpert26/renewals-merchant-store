import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Points balances, claims and admin data must always be read fresh from the
  // ledger, so this app uses request-time rendering instead of Cache Components.
  cacheComponents: false,
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
