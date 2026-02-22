import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Docker 部署需要 standalone 模式
  // 这会生成独立的服务器文件，不依赖 node_modules
  output: "standalone",

  // API 代理：解决 HTTPS → HTTP 混合内容问题
  // 前端请求 /api/* → Vercel 代理 → 后端服务器
  // BACKEND_URL 必须在 Vercel 环境变量中配置
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL;
    if (!backendUrl) {
      console.warn("BACKEND_URL is not set - API rewrites will not work");
    }
    return backendUrl
      ? [
          {
            source: "/api/:path*",
            destination: `${backendUrl}/api/:path*`,
          },
        ]
      : [];
  },
};

export default nextConfig;
