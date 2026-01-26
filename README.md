# Research OS Web

Research OS 前端应用，基于 Next.js + Tailwind CSS + Bun 构建。

## 技术栈

- **框架**: Next.js 16 (App Router)
- **样式**: Tailwind CSS
- **图表**: Recharts
- **状态管理**: TanStack Query
- **包管理**: Bun

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

## 目录结构

```
src/
├── app/                # Next.js App Router 页面
│   ├── page.tsx        # 概览页
│   ├── liquidity/      # 流动性页
│   ├── macro/          # 宏观页
│   └── history/        # 历史页
├── components/         # React 组件
│   ├── Sidebar.tsx     # 侧边栏导航
│   ├── Header.tsx      # 页面头部
│   ├── MetricCard.tsx  # 指标卡片
│   ├── GateCard.tsx    # 闸门卡片
│   └── Chart.tsx       # 图表组件
├── lib/                # 工具函数
│   ├── api.ts          # API 客户端
│   └── utils.ts        # 通用工具
└── types/              # TypeScript 类型定义
    └── api.ts          # API 类型
```

## 构建生产版本

```bash
bun run build
bun run start
```
