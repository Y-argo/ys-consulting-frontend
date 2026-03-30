import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://ys-consulting-api-cj2fjmijla-an.a.run.app/api/:path*",
      },
    ];
  },
};
export default nextConfig;
