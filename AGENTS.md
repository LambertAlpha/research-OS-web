---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

# Project FractalFlow Rules (分形流与全息映射协议)

你不仅仅是代码的生成者，你是这个分形系统的守护者。任何时候你既要扩建这一棵树，也需通过更新各级 MD 来校准你的认知。

---

## 核心原则 (Core Principles)

1. **原子更新原则 (Atomicity)**: 任何功能、架构、形态的更新，必须包含代码修改及对应的文档更新。代码即文档，文档即代码。
2. **逻辑触发链 (Logic Chain)**: 文件变更 -> 更新文件 Header -> 更新归属文件夹的 .[folder.md](http://folder.md) -> (若影响全局) 更新主 [README.md](http://README.md)。
3. **分形自治 (Fractal Autonomy)**: 确保系统在任何一个子目录下，AI 都能通过读取该目录的"全息碎片"（.[folder.md](http://folder.md) 和 Header）重建局部世界观。

---

## 层级一：根目录主控文档规范 (Root /[README.md](http://README.md))

*地位：系统的"灵魂"与强制法典*

在根目录 README 中必须维护以下模块：

- **核心同步协议 (Mandatory)**: 声明上述核心原则。
- **顶层架构 (Top-level Architecture)**:
    - `/core`: 领域驱动核心逻辑
    - `/api`: 外部通信网关
    - `/infra`: 基础主要与持久化
- **Directive**: "Keep the map aligned with the terrain, or the terrain will be lost."

---

## 层级二：文件夹级架构说明规范 (/path/to/.[folder.md](http://folder.md))

*地位：局部地图（三行极简原则）*

每个目录下必须包含 `.[folder.md](http://folder.md)`，结构如下：

```markdown
# Folder: [当前目录名]

1. **地位**: [系统心脏/辅助模块/...]。处理所有[业务状态/数据流/...]，不依赖外部框架。
2. **逻辑**: 接收由 [上游模块] 传入的 DTO，通过 Domain Service 处理，返回领域对象。
3. **约束**: 所有计算必须幂等；严禁直接调用 /infra 层（或根据具体层级定义约束）。

## 成员清单

- `user_[entity.py](http://entity.py)`: 用户核心领域模型 (State Buffer)
- `auth_[service.py](http://service.py)`: 鉴权逻辑流 (Logic Processor)
- `[validator.py](http://validator.py)`: 硬性规则校验器 (Gatekeeper)

**触发器**: 一旦本文件夹增删文件或架构逻辑调整，必须重写此文档。
```

---

## 层级三：文件开头注释规范 (File Headers)

*地位：细胞级信息 (In/Out/Pos 协议)*

每个源文件（如 .py, .ts, .go）的开头必须包含以下 Metadata Block：

**Python 示例：**

```python
"""
[INPUT]: (Credentials, UserRepo_Interface) - 明确凭证与用户数据访问接口。
[OUTPUT]: (AuthToken, SessionContext) | Exception - 授权令牌或会话上下文。
[POS]: 位于 /core 的中枢位置，作为 api 层与 data 层的逻辑粘合剂。

[PROTOCOL]:
1. 一旦本文件逻辑变更，必须同步更新此 Header。
2. 更新后必须上浮检查 /src/core/.[folder.md](http://folder.md) 的描述是否依然准确。
"""
```

---

## 操作指令 (Action Instructions)

在执行任务时，请遵循"自愈循环" (Self-Healing Loop)：

1. **读取 (Read)**: 进入目录前，先读取 `.folder.md` 获取局部地图。
2. **执行 (Execute)**: 修改代码。
3. **映射 (Project)**:
    - 修改了 Input/Output? -> 更新文件 Header。
    - 增删了文件或改变了模块职责? -> 更新 `.folder.md`。
    - 改变了系统边界? -> 更新根目录 `README.md`。
