# Research OS Web

Research OS 前端应用，基于 Next.js + Tailwind CSS + Bun 构建的宏观研究智能平台。

> **Directive**: "Keep the map aligned with the terrain, or the terrain will be lost."

---

## 核心同步协议 (Mandatory)

1. **原子更新原则 (Atomicity)**: 任何功能、架构、形态的更新，必须包含代码修改及对应的文档更新。代码即文档，文档即代码。
2. **逻辑触发链 (Logic Chain)**: 文件变更 → 更新文件 Header → 更新归属文件夹的 `.folder.md` → (若影响全局) 更新本 README.md。
3. **分形自治 (Fractal Autonomy)**: 确保系统在任何一个子目录下，AI 都能通过读取该目录的"全息碎片"（`.folder.md` 和 Header）重建局部世界观。

---

## 顶层架构 (Top-level Architecture)

```
src/
├── app/            # 页面路由层 — Next.js App Router，定义用户可达的 URL 与页面组件
├── components/     # UI 组件层 — 可复用的 React 展示组件，纯渲染逻辑
├── lib/            # 服务层 — API 客户端、工具函数，承载所有与后端交互的逻辑
└── types/          # 契约层 — TypeScript 类型定义，前后端数据结构的唯一真相源
```

### 数据流向

```
用户操作 → 页面组件(app/) → API客户端(lib/api.ts) → Next.js Rewrite → 后端(research-OS)
                ↓
        UI组件(components/) ← 状态(useState) ← API响应(types/api.ts 类型约束)
```

### 与后端的边界

- 前端通过 `next.config.ts` 的 `rewrites()` 代理 `/api/*` 请求到后端服务
- 所有数据契约定义在 `src/types/api.ts`，与后端 Python 模型的输出结构一一对应
- 前端不包含任何业务计算逻辑，仅负责数据展示与交互

---

## 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 框架 | Next.js 16 (App Router) | SSR/SSG 页面路由 |
| 语言 | TypeScript (strict) | 类型安全 |
| 样式 | Tailwind CSS | 原子化 CSS |
| 图表 | Recharts | 金融数据可视化 |
| 状态 | TanStack Query | 数据请求缓存 |
| 图标 | Lucide React | 图标库 |
| 运行时 | Bun | 包管理 + 构建 |

---

## 快速开始

### 1. 安装依赖

```bash
bun install
```

### 2. 配置环境变量

创建 `.env.local` 文件:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. 启动后端 API

在 research-OS 目录下:

```bash
source .venv/bin/activate
python api/main.py
```

API 将在 http://localhost:8000 运行。

### 4. 启动前端开发服务器

```bash
bun run dev
```

访问 http://localhost:3000

---

## 构建生产版本

```bash
bun run build
bun run start
```

---

## 路由结构

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | Overview | 全局市场概览仪表板 |
| `/liquidity` | Liquidity | 流动性模型 v3.0 深度分析 |
| `/macro` | Macro | 宏观模型 v4.0 多维度信号 |
| `/history` | History | 规则触发与告警历史记录 |
