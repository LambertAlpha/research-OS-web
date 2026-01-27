# ============================================================
# Research OS Web 前端 Dockerfile
# ============================================================
#
# 这是一个"多阶段构建"的 Dockerfile
# 分为 3 个阶段：基础 -> 构建 -> 生产
# 最终镜像只包含运行所需的最小内容
#

# ============================================================
# 阶段 1：基础镜像 (base)
# ============================================================
# FROM ... AS xxx 是给这个阶段起个名字，后面可以引用
# oven/bun 是 Bun 官方镜像，基于 Debian
FROM oven/bun:1 AS base

# 设置工作目录
WORKDIR /app

# ============================================================
# 阶段 2：安装依赖 (deps)
# ============================================================
# 这一层专门处理依赖安装，利用 Docker 缓存
FROM base AS deps

# 只复制依赖相关的文件（不是全部代码）
# 如果这些文件没变，Docker 会跳过依赖安装步骤
COPY package.json bun.lock ./

# 安装依赖
# 开发阶段不用 --frozen-lockfile，等 lockfile 稳定后再启用
RUN bun install

# ============================================================
# 阶段 3：构建应用 (builder)
# ============================================================
FROM base AS builder

WORKDIR /app

# 从 deps 阶段复制 node_modules
# 这样如果依赖没变，这一步直接用缓存
COPY --from=deps /app/node_modules ./node_modules

# 复制所有源代码
COPY . .

# 设置环境变量
# NEXT_TELEMETRY_DISABLED=1: 禁用 Next.js 匿名统计
ENV NEXT_TELEMETRY_DISABLED=1

# 构建 Next.js 应用
# 这会生成 .next 目录，包含优化后的生产代码
RUN bun run build

# ============================================================
# 阶段 4：生产镜像 (runner)
# ============================================================
# 这是最终的镜像，只包含运行所需的内容
FROM base AS runner

WORKDIR /app

# 设置为生产环境
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户（安全最佳实践）
# 不要用 root 运行应用，万一被攻破，攻击者权限也有限
# Bun 镜像基于 Debian，使用 groupadd/useradd 而非 addgroup/adduser
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

# 复制构建产物
# Next.js standalone 模式会生成独立的服务器文件
# public: 静态资源（图片、字体等）
# .next/standalone: 独立服务器代码
# .next/static: 客户端 JS/CSS

# 复制 public 目录（如果存在）
COPY --from=builder /app/public ./public

# 复制 standalone 输出
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 设置端口环境变量
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 启动命令
# Next.js standalone 模式生成的 server.js
CMD ["bun", "server.js"]
