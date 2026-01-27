import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Docker 部署需要 standalone 模式
  // 这会生成独立的服务器文件，不依赖 node_modules
  output: "standalone",
};

export default nextConfig;
