import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.KFC_BUILD_STANDALONE === "1" ? "standalone" : undefined,
  outputFileTracingExcludes: {
    "/*": [
      "./.local/**/*",
      "./output/**/*",
      "./.playwright-cli/**/*",
      "./**/*.kfcbackup",
      "./**/.kfc-restore-*/**",
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
