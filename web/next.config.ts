import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Admin 전체가 쿠키 기반 세션에 의존하므로 Cache Components를 사용하지 않는다.
  cacheComponents: false,
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
