/**
 * [INPUT]: NextRequest（Next.js Edge runtime 拦截所有 /api/* 请求）
 * [OUTPUT]: NextResponse — 写操作（非 GET/HEAD/OPTIONS）补入 X-API-Key header
 * [POS]: 位于 src/middleware.ts，Next.js 自动加载。
 *        在 next.config.ts 的 rewrites 之前 run，注入的 header 会跟随 rewrite
 *        转发到 BACKEND_URL。
 *
 * [PROTOCOL]:
 * 1. 安全收紧（M7）：API_KEY 不再走 NEXT_PUBLIC_*（client bundle 暴露），
 *    改为 server-only env 变量，在 middleware 内为写操作注入。
 * 2. 仅匹配 /api/*；GET/HEAD/OPTIONS 不变（读端点无需认证）。
 * 3. Vercel 部署需要：删除 NEXT_PUBLIC_API_KEY，新增 API_KEY（server-only）
 *    本地 .env.local 同步迁移。
 */
import { NextRequest, NextResponse } from "next/server";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function middleware(req: NextRequest) {
  if (READ_METHODS.has(req.method)) {
    return NextResponse.next();
  }
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    // 服务端未配置 API_KEY，让请求继续（后端会拒绝），日志可在 Vercel 看
    return NextResponse.next();
  }
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("X-API-Key", apiKey);
  return NextResponse.next({ request: { headers: reqHeaders } });
}

export const config = {
  matcher: "/api/:path*",
};
