import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Docker 部署需要 standalone 模式
  // 这会生成独立的服务器文件，不依赖 node_modules
  output: "standalone",

  // API 代理：解决 HTTPS → HTTP 混合内容问题
  // 前端请求 /api/* → Vercel 代理 → 后端服务器
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_URL || "http://202.81.229.139:8000"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
