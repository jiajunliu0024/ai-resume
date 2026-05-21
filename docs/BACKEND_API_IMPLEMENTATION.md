# Resume Tailor — 后端 API 实现文档

本文档面向 **独立后端仓库**（建议新 Cursor 窗口：`ai-resume-api`），与已上架的 Chrome 扩展 [ai-resume](https://github.com/jiajunliu0024/ai-resume) 对接。扩展继续负责：读 tab、存简历/JD、UI；后端仅负责 **托管 OpenAI Key、配额、Scan / Cover letter AI**。

**版本对齐**：扩展 `0.1.1`（manifest MV3）。后端建议初始版本 `1.0.0`。

### 文档导航

| 部分 | 章节 | 适合阶段 |
|------|------|----------|
| 规格 | §1–§17 | 查 API、prompt、部署 |
| **自学 + 分步实现** | **§18–§22** | 从零写后端、学 TS / 框架 |
| 联调 | §11、§15 | 扩展仓库改 cloud 客户端 |

---

## 1. 目标与范围

### 1.1 产品目标

- 用户 **无需自备 API Key** 即可 Scan JD、生成 Cover letter（免费额度）。
- **无登录**：匿名 `deviceId` + 服务端配额。
- **7 日蜜月**（device 首次请求起）额度宽松，之后收紧。
- **全站月度预算约 USD 200**（硬顶，防止 Key 被盗刷破产）。
- **OpenAI API Key 仅存在于服务器环境变量**，禁止写入扩展包。

### 1.2 MVP 包含

| 能力 | HTTP |
|------|------|
| JD 结构化提取（Scan AI 部分） | `POST /v1/scan` |
| Cover letter 生成 | `POST /v1/cover-letter` |
| 配额查询（UX） | `GET /v1/quota` |
| 健康检查 | `GET /health` |

### 1.3 MVP 不包含（第二期）

- Tailor 段落改写（`tailorSegmentRewriter.ts`）
- 简历 PDF Vision / 纯文本 AI 解析（`aiResumeParser.ts`）
- 用户登录、支付、简历云存储
- 多模型 / 多提供商路由（MVP 固定 **OpenAI `gpt-4o-mini`**）

---

## 2. 架构（前后端分离）

```text
┌─────────────────────────────────────┐
│ Chrome Extension (前端仓库 ai-resume) │
│  - readActiveTabText() 本地注入      │
│  - scanJobPage() 本地 fallback       │
│  - chrome.storage 存 JD / 简历       │
│  - cloudAiClient → HTTPS             │
└──────────────────┬──────────────────┘
                   │ X-Device-Id
                   │ X-Extension-Version
                   ▼
┌─────────────────────────────────────┐
│ API Server (本仓库 ai-resume-api)    │
│  - Hono / Express                    │
│  - Upstash Redis（配额 + 月成本）     │
│  - OPENAI_API_KEY（env）             │
└──────────────────┬──────────────────┘
                   │
                   ▼
            OpenAI Chat Completions
            gpt-4o-mini, json_object
```

**数据边界**

- 扩展 **不上传** 完整 PDF 文件到后端（MVP）。
- 请求体可能含：**JD 纯文本**、**简历摘录纯文本**；后端 **不应持久化** 这些内容（仅可选错误日志，建议 MVP 零内容日志）。
- 扩展本地 `chrome.storage` 行为不变（见 `src/shared/storageKeys.ts`）。

---

## 3. 推荐技术栈

| 层 | 选型 | 说明 |
|----|------|------|
| 语言 | TypeScript (Node 20+) | 与扩展一致，prompt 可从扩展复制 |
| HTTP | [Hono](https://hono.dev) + `@hono/node-server` | 轻量，路由少 |
| AI | `openai` 官方 SDK 或 `fetch` 直连 | 与扩展相同 JSON shape |
| 配额存储 | [Upstash Redis](https://upstash.com) | HTTP Redis，适合 serverless |
| 部署 | Railway / Fly.io | 环境变量、`https://api.<domain>` |
| 校验 | `zod` | 请求 body |

**不建议 MVP**：NestJS、Postgres（仅为计数过重）、把 Key 放在 Worker 客户端可见处。

---

## 18. 学习方法（如何一边做后端一边学）

### 18.1 原则

1. **每步只加一个概念**：先跑通 `GET /health`，再加路由，再加 OpenAI，最后 Redis 配额。
2. **先抄扩展再抽象**：prompt、`makeId` 直接从 `ai-resume` 复制，确认行为一致后再抽 `services/`。
3. **每步可运行、可验证**：用 `curl` 或 REST Client 插件，不要堆三天代码再一次跑。
4. **两个窗口分工**：
   - **窗口 B（ai-resume-api）**：按 §19 步骤写后端；
   - **窗口 A（ai-resume）**：仅阅读 §15 源文件、§11 联调；避免同时改两边导致分不清 bug 在哪。
5. **笔记**：每完成一步在 `ai-resume-api/LEARNING.md` 记 3 行（今天学了什么、踩坑、明天做什么）。

### 18.2 推荐每日节奏（约 2–4 周完成 MVP）

| 类型 | 时间 | 内容 |
|------|------|------|
| 学理论 | 30–45 min | 看 §18.3 对应 TS/框架小节 + 官方文档一节 |
| 写代码 | 60–90 min | 完成 §19 中 **一个** 步骤（只一个） |
| 验证 | 15 min | `curl` / `npm test` / 浏览器 Network |
| 复盘 | 10 min | 更新 `LEARNING.md` |

不必一次学完 TypeScript 再写项目；**在项目里学**效率更高。

### 18.3 和扩展前端 TS 的关系

你已在扩展里写过 React + `async/await` + `fetch`，下列后端概念 **大多见过**，只是换环境：

| 扩展里已有 | 后端同样用法 |
|------------|--------------|
| `type` / `interface`（`domain/jobDescription.ts`） | `src/types/api.ts` 请求响应 |
| `async function` + `try/catch`（`App.tsx`） | 路由 handler |
| `fetch` + `JSON`（`openAiJobInsightsExtractor.ts`） | 调 OpenAI 或 Upstash REST |
| `Record<string, T>`（providerConfigs） | 环境变量 / 配置对象 |
| `zod` 未用 | 后端建议学 **zod** 校验 body |

后端**新增**的重点：`import` 跑在 Node、环境变量、`req`/`res` 或 Hono `c`、Redis 键、无 DOM。

---

## 19. TypeScript 基础（按本后端用到的学，不追求全书）

### 19.1 第一周必会（够写 Step 1–5）

按顺序学，每条都在本仓库写一小段练习代码验证。

| 主题 | 要会什么 | 练习建议 |
|------|----------|----------|
| 类型注解 | `const n: number = 1`、`function f(x: string): boolean` | 给 `makeId` 加类型 |
| `interface` / `type` | 定义 API 请求体、响应体 | 复制 §7 的 JSON 为 `ScanRequest` |
| 联合类型 | `"honeymoon" \| "standard"` | `phase` 字段 |
| 可选属性 | `jobTitle?: string` | 对齐 OpenAI 解析 `Partial<>` |
| 数组方法 | `map`, `filter`, `slice` | 规范化 requirements 最多 8 条 |
| `async`/`await` | 异步函数返回 `Promise<T>` | 封装 `callOpenAi()` |
| `try`/`catch` | 捕获 `JSON.parse`、fetch 失败 | 路由里返回 502 |
| 模块 | `import` / `export` | 拆 `routes/scan.ts` |
| 泛型（入门） | `Promise<ScanResponse>` | 读 OpenAI SDK 类型即可 |

**可跳过（MVP 不需要）**：装饰器、复杂泛型约束、namespace、枚举（用 string union 代替）。

### 19.2 对照扩展精读（各 20 分钟）

在 **ai-resume** 窗口打开并读懂（不必改）：

1. `src/domain/jobDescription.ts` — `ExtractedRequirement` 形状 → 后端响应要对齐。
2. `src/infrastructure/ai/openAiJobInsightsExtractor.ts` — `parseOpenAiJson`、`normalizeRequirement`、`makeId` → **Step 8 原样搬**。
3. `src/infrastructure/ai/aiProviderHttpError.ts` — 错误怎么映射 → **Step 9** 服务端同样逻辑。

### 19.3 推荐 TS 学习资源（选 1–2 个即可）

| 资源 | 用法 |
|------|------|
| [TypeScript Handbook（官方）](https://www.typescriptlang.org/docs/handbook/intro.html) | 查 `interface`、`async`、`narrowing` |
| [TypeScript Exercises](https://typescript-exercises.github.io/) | 每天 2–3 题 |
| 扩展仓库 `npm run typecheck` | 改后端时同样开 `strict: true` |

---

## 20. 框架与工具学习顺序（只学会用到的）

### 20.1 学习顺序总览

```text
Node + npm + tsx
    → Hono（路由、中间件、JSON）
        → zod（校验 body）
            → openai SDK（chat completions）
                → @upstash/redis（INCR、GET、SET）
                    → 部署（Railway 环境变量）
```

不要并行学 Nest + Prisma + Docker；MVP 用不上。

### 20.2 Node.js（1 天）

| 概念 | 在本项目中的用途 |
|------|------------------|
| `package.json` scripts | `"dev": "tsx watch src/index.ts"` |
| 环境变量 `process.env` | `OPENAI_API_KEY` |
| 无 `window` / `document` | 纯服务端 |

**练习**：`console.log(process.env.PORT ?? 3000)`，`.env` 用 `.env.example` 复制，**勿提交 .env**。

### 20.3 Hono（2–3 天）

| 概念 | 文档 | 本项目 |
|------|------|--------|
| `new Hono()` | [Hono Getting Started](https://hono.dev/docs/getting-started/nodejs) | `src/index.ts` |
| `app.get/post` | 路由 | `/health`, `/v1/scan` |
| `c.req.json()` | 读 body | Scan 请求 |
| `c.json({ ... }, 200)` | 响应 | 成功 / 错误体 |
| `app.use('*', cors(...))` | CORS 中间件 | §9 |
| 子路由 `app.route('/v1', v1)` | 组织代码 | `routes/*.ts` |

**练习**：先写 `GET /health` 返回 `{ ok: true }`，用 `curl localhost:3000/health`。

### 20.4 Zod（半天）

```typescript
import { z } from "zod";

const ScanBodySchema = z.object({
  rawText: z.string().min(1).max(14000),
  pageTitle: z.string().optional(),
  sourceUrl: z.string().url().optional(),
});

// handler 内: const body = ScanBodySchema.parse(await c.req.json());
// 失败 → catch ZodError → 400 invalid_request
```

**原则**：所有 `POST` body 都 schema 校验，避免坏数据进 OpenAI 浪费钱。

### 20.5 OpenAI SDK（1 天）

| 要点 | 说明 |
|------|------|
| `new OpenAI({ apiKey: process.env.OPENAI_API_KEY })` | 仅 `services/openai.ts` |
| `chat.completions.create` | `model`, `messages`, `temperature`, `response_format` |
| 取结果 | `completion.choices[0]?.message?.content` |
| 费用 | MVP 用固定估算写入 Redis（§6.3），不必先接 usage 账单 |

**练习**：单独脚本 `scripts/test-openai.ts` 发一条「返回 `{"hello":1}` 的 JSON」，确认 Key 有效。

### 20.6 Upstash Redis（1–2 天）

| 命令用途 | Upstash REST / SDK |
|----------|-------------------|
| 读 firstSeen | `GET device:{id}:firstSeen` |
| 日计数 | `INCR quota:{id}:{date}:scan` |
| 月成本 | `INCRBYFLOAT global:cost:2026-05 0.004` |
| TTL | 计数键 48h 过期 |

**练习**：写 `services/quota.ts` 纯函数 `getPhase(firstSeen)`、`checkAndIncrement(deviceId, op)`，先 mock Redis 再换真 Redis。

### 20.7 部署（半天）

Railway：连 GitHub → 选 `ai-resume-api` → Variables 填 §10 → 生成域名 → 本地 `curl https://api.xxx/health`。

---

## 21. 分步实现计划（12 步，每步 1 次提交）

在 **新仓库** `ai-resume-api` 按顺序做；每步结束应 **能运行、能 curl**。估计 **15–25 小时** 总量（含学习）。

### Step 0：仓库与工具链

**目标**：空项目能 `npm run dev` 打印 Hello。

```bash
mkdir ai-resume-api && cd ai-resume-api
git init
npm init -y
npm i hono @hono/node-server zod
npm i -D typescript @types/node tsx
npx tsc --init  # strict: true
```

`package.json` scripts:

```json
"dev": "tsx watch src/index.ts",
"typecheck": "tsc --noEmit"
```

`src/index.ts`：启动 Hono + `serve` 监听 `PORT`。

**验收**：`curl http://localhost:3000/health`（Step 1 可先占位）。

**学到**：npm、tsx、TS 编译、`import`。

---

### Step 1：`GET /health`

**目标**：§7.1 健康检查。

**文件**：`src/routes/health.ts`，在 `index.ts` 挂载。

**验收**：`{ "ok": true, "version": "1.0.0" }`。

---

### Step 2：中间件 — `X-Device-Id`

**目标**：§5 校验 UUID；缺 header → 400。

**文件**：`src/middleware/deviceId.ts`，挂到 `/v1/*`。

**验收**：无 header POST → 400；带合法 UUID → 进入路由。

**学到**：Hono `createMiddleware`、`c.get`/`c.set` 存 `deviceId`。

---

### Step 3：CORS

**目标**：§9，允许 `chrome-extension://`（开发可先 `*`）。

**文件**：`src/middleware/cors.ts`。

**验收**：浏览器扩展 `fetch` 不报 CORS（联调在 Step 12）。

---

### Step 4：`POST /v1/scan` 骨架（不调 AI）

**目标**：zod 校验 body，返回 **假数据**（固定 1 条 requirement）。

**文件**：`src/routes/scan.ts`、`src/types/api.ts`、`prompts/scan.ts`（先空）。

**验收**：`curl -X POST .../v1/scan -H "X-Device-Id: $(uuidgen)" -d '{"rawText":"need Python"}'` → 200 假 JSON。

**学到**：`zod`、`c.req.json()`、类型 `ScanResponse`。

---

### Step 5：接入 OpenAI — Scan 真结果

**目标**：§8.1 prompt；§8.3 `normalizeScan`（从扩展复制 `makeId`）。

**文件**：`src/services/openai.ts`、`src/services/normalizeScan.ts`。

**验收**：真实 JD 文本 → 返回 `jobTitle`、`requirements` 最多 8 条、带 `id`。

**注意**：控制 `rawText` 长度；失败返回 502，不把 OpenAI 原文返回给用户。

**学到**：`async` handler、OpenAI SDK、`JSON.parse` + try/catch。

---

### Step 6：`POST /v1/cover-letter`

**目标**：§7.4、§8.2；先不接配额。

**文件**：`src/routes/coverLetter.ts`、`prompts/coverLetter.ts`。

**验收**：最小 body（jobTitle、company、jdSnippet、空数组 resumeBlocks）→ `{ "letter": "..." }`。

**学到**：字符串模板拼 prompt（对照 `openAiCoverLetterGenerator.ts`）。

---

### Step 7：配额服务（内存版）

**目标**：实现 §6 逻辑，**先用 `Map` 内存** 代替 Redis，便于理解。

**文件**：`src/services/quota.ts` — `getPhase`、`checkLimit`、`recordUsage`、`addGlobalCost`。

**验收**：同一 device 第 11 次 scan（蜜月 limit 10）→ 429。

**学到**：日期 `YYYY-MM-DD` UTC、`dayIndex` 计算。

---

### Step 8：换成 Upstash Redis

**目标**：把 Step 7 的 Map 换成 `@upstash/redis`。

**文件**：`src/config.ts` 读 env；`quota.ts` 改实现。

**验收**：重启进程后配额仍累计（Redis 持久）；两终端共用一个 deviceId 计数一致。

**学到**：Redis INCR、TTL、环境变量。

---

### Step 9：统一错误体 + OpenAI 401/429

**目标**：对齐扩展 `AI_API_NOT_VALID_MESSAGE`；§7 错误表。

**文件**：`src/lib/errors.ts` 或 `services/errors.ts`。

**验收**：故意错 Key → 扩展能显示的短文案；429 `quota_exceeded` 含 `resetsAt`。

---

### Step 10：`GET /v1/quota`

**目标**：§7.2，给扩展 Settings / Scan 显示剩余次数。

**验收**：蜜月 device 返回 `limits.scan.used/limit`。

---

### Step 11：部署到 Railway

**目标**：HTTPS 公网 URL；§14 检查清单。

**验收**：`curl https://api.xxx/health`；环境变量无 Key 泄露到日志。

---

### Step 12：扩展联调（回到 ai-resume 窗口）

**目标**：§11 全部项；manifest `host_permissions`；默认 cloud 模式。

**验收**：SEEK 页 Scan + Cover letter 无用户 Key；quota 用尽有提示。

**学到**：端到端、Chrome DevTools Network 看请求头与响应。

---

### 实现顺序依赖图

```text
Step 0–1 → 2–3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12
              ↑中间件    ↑Scan   ↑信    ↑配额  ↑Redis
```

---

## 22. 调试、测试与常见坑

### 22.1 本地调试习惯

| 工具 | 用途 |
|------|------|
| `curl` / Bruno / Postman | 重复打 `/v1/scan` |
| `console.error` | 仅打 **错误类型**，勿打完整 JD/简历 |
| `tsx watch` | 改代码自动重启 |
| VS Code 断点 | 在 `quota.ts`、`scan` handler 暂停 |

### 22.2 建议的最小测试（可选，Step 7 后）

`npm i -D vitest`，测纯函数：

- `getPhase(firstSeen, now)` → honeymoon / standard
- `makeId("ai-requirement", "Python")` → 与扩展一致
- `parseScanJson(invalid)` → 抛错或 fallback

不必追求 100% 覆盖率；**配额与钱相关的逻辑**优先测。

### 22.3 常见坑

| 现象 | 原因 | 处理 |
|------|------|------|
| CORS 错误 | 未允许 extension origin | §9 |
| 401 from OpenAI | Key 错或未加载 `.env` | `echo $OPENAI_API_KEY` 勿提交 git |
| 返回 JSON 但扩展解析失败 | `id` / 字段名不一致 | 对照 §7.3 |
| 配额不准 | 服务器时区非 UTC | 统一 `toISOString().slice(0,10)` |
| 成本爆掉 | 未做 global cap | Step 8 必须上 Redis 月顶 |
| `JSON.parse` 崩 | 模型没返回纯 JSON | `response_format: json_object` + 502 |

### 22.4 学完后的能力清单（自测）

- [ ] 能独立加一个 `POST /v1/xxx` 路由 + zod + 错误码  
- [ ] 能解释 `deviceId` 存在哪、配额键长什么样  
- [ ] 能说明为何 Key 不能放在扩展里  
- [ ] 能用 curl 模拟扩展请求头联调  
- [ ] 能读 OpenAI 账单并对照 Redis `global:cost`  

---

## 4. 仓库结构（建议）

```text
ai-resume-api/
  package.json
  tsconfig.json
  .env.example
  README.md
  src/
    index.ts                 # 启动、CORS、挂载路由
    config.ts                # 环境变量、限额常量
    middleware/
      deviceId.ts
      cors.ts
    routes/
      health.ts
      scan.ts
      coverLetter.ts
      quota.ts
    services/
      openai.ts              # chat completions 封装
      quota.ts               # 蜜月、日限、global cost
      normalizeScan.ts       # makeId、category 规范化（见扩展）
    prompts/
      scan.ts                # 从扩展复制 system + user 模板
      coverLetter.ts
    types/
      api.ts                 # 请求/响应 TypeScript 类型
```

---

## 5. 鉴权与请求头

无 Bearer 用户 token。每个请求必须带：

| Header | 必填 | 说明 |
|--------|------|------|
| `X-Device-Id` | 是 | UUID v4，扩展 `chrome.storage.local` 生成并持久化 |
| `X-Extension-Version` | 否 | 如 `0.1.1`，便于排查 |
| `Content-Type` | POST | `application/json` |

**deviceId 校验**

- 正则建议：`^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`（不区分大小写）
- 非法 → `400` `{ "error": "invalid_device_id" }`

**首次见到 device**

- Redis：`device:{id}:firstSeen` → ISO 8601 UTC（`SETNX`，仅第一次写入）
- 用于计算 `phase`：`honeymoon`（day 0–6）vs `standard`（day 7+）

---

## 6. 配额与预算

### 6.1 阶段

```text
dayIndex = floor((nowUTC - firstSeenAt) / 86400000)
phase = dayIndex <= 6 ? "honeymoon" : "standard"
```

### 6.2 每 device 每日限额（UTC 日历日 `YYYY-MM-DD`）

| 操作 | Redis 字段后缀 | 蜜月 limit | 常态 limit |
|------|----------------|------------|------------|
| Scan | `:scan` | 10 | 3 |
| Cover letter | `:cover_letter` | 5 | 1 |

键示例：`quota:{deviceId}:{date}:scan` → `INCR`，TTL 48h。

**检查顺序**（每次 AI 调用前）

1. 全站月成本是否 ≥ 硬顶（§6.3）
2. device 日配额是否超限
3. 通过后调用 OpenAI，成功后 `INCR` 计数 + 累加成本

### 6.3 全站月度预算（USD 200）

| Redis 键 | 说明 |
|----------|------|
| `global:cost:{YYYY-MM}` | 浮点累计估算成本 |

**每次成功调用后累加（估算）**

| 操作 | 默认估算 USD/次 |
|------|-----------------|
| `scan` | `0.004` |
| `cover_letter` | `0.020` |

（可按 `usage` token 微调；MVP 用固定值即可。）

**阈值行为**

| 累计 cost | 行为 |
|-----------|------|
| < 180 | 正常 |
| 180 ≤ cost < 200 | `phase` 视为 `global_cap`：`cover_letter` 拒绝；`scan` 仍允许 |
| ≥ 200 | 全部 AI 拒绝 `503` 或仅保留 1 次/设备/日 scan（实现时二选一，建议全部拒绝并提示 BYOK） |

### 6.4 IP 限流（可选，建议）

- `ip:{ip}:{date}:requests` INCR，上限如 500/日，防单 IP 批量注册 device。

---

## 7. API 规范

Base URL 示例：`https://api.resume-tailor.example`（部署后替换）。

统一错误体：

```json
{
  "error": "quota_exceeded",
  "message": "Human-readable message for UI",
  "operation": "scan",
  "limit": 3,
  "used": 3,
  "resetsAt": "2026-05-21T00:00:00.000Z"
}
```

### 7.1 `GET /health`

响应 `200`：

```json
{ "ok": true, "version": "1.0.0" }
```

---

### 7.2 `GET /v1/quota`

**响应 `200`**

```json
{
  "phase": "honeymoon",
  "daysSinceFirstSeen": 2,
  "limits": {
    "scan": { "used": 1, "limit": 10 },
    "coverLetter": { "used": 0, "limit": 5 }
  },
  "resetsAt": "2026-05-21T00:00:00.000Z",
  "globalCapActive": false
}
```

`phase` 枚举：`honeymoon` | `standard` | `global_cap`。

---

### 7.3 `POST /v1/scan`

对应扩展：`extractJobInsightsWithAiProvider`（`src/infrastructure/ai/openAiJobInsightsExtractor.ts`）。

**请求 body**

```json
{
  "rawText": "string, required, max 14000 chars",
  "pageTitle": "optional string",
  "sourceUrl": "optional string"
}
```

**成功 `200`** — 与扩展 `ExtractJobInsightsResult` + 带 `id` 的 `ExtractedRequirement` 对齐：

```json
{
  "jobTitle": "Graduate Software Engineer",
  "company": "Acme Pty Ltd",
  "requirements": [
    {
      "id": "ai-requirement-python",
      "text": "Python",
      "category": "skill",
      "importance": "high",
      "evidence": "Experience with Python required"
    }
  ],
  "keywords": [],
  "confidence": 0.82
}
```

**服务端必须实现（与扩展一致）**

1. 调用 OpenAI 后解析 JSON（见 §8.1）。
2. `requirements` 最多 **8** 条，`keywords` 最多 **14** 条。
3. 每条生成稳定 `id`（§8.3 `makeId`）。
4. `category` 不在白名单时改为 `other`。
5. `confidence` clamp 到 `[0, 1]`，缺省 `0.75`。

**扩展侧合并逻辑**（后端不需做，供联调理解）

扩展在 `App.tsx` `handleScanCurrentPage` 中：

```text
result = scanCurrentTab(readActiveTabText)   // 本地 title, url, rawText, debugLog
ai = POST /v1/scan { rawText: result.rawText }
merged = {
  ...result,
  title: ai.jobTitle || result.title,
  company: ai.company || result.company,
  requirements: ai.requirements,
  keywords: ai.keywords,
  confidence: ai.confidence,
}
```

**错误**

| HTTP | error | message 建议 |
|------|-------|----------------|
| 400 | `invalid_request` | 校验失败 |
| 429 | `quota_exceeded` | Today's free scans are used up... |
| 429 | `global_budget_exceeded` | Free AI for this month is fully used... |
| 502 | `provider_error` | AI is temporarily unavailable. |
| 503 | `maintenance` | 月预算耗尽 |

OpenAI 401/429：对用户统一 `message`: **`This API is not valid.`**（与扩展 `AI_API_NOT_VALID_MESSAGE` 一致，勿透传原始 JSON）。

---

### 7.4 `POST /v1/cover-letter`

对应扩展：`generateCoverLetterWithAiProvider`（`src/infrastructure/ai/openAiCoverLetterGenerator.ts`）。

扩展在 `generateCoverLetter.ts` 中组装请求前会：

- `jdSnippet = job.rawText.slice(0, 6000)`
- `keywordLines` / `requirementLines` 来自用户勾选的 id
- `resumeBlocks` 来自 `listResumeChunksForCoverLetter(resume)`

**请求 body**

```json
{
  "jobTitle": "string, required",
  "company": "string, required",
  "jdSnippet": "string, required, max 6000 recommended",
  "keywordLines": ["string"],
  "requirementLines": ["string"],
  "resumeBlocks": [
    { "heading": "Experience — Company", "body": "plain text excerpt" }
  ]
}
```

**成功 `200`**

```json
{
  "letter": "Dear Hiring Team,\n\n..."
}
```

**错误**：同 §7.3，`operation` 为 `cover_letter`。

---

## 8. OpenAI 调用细节

### 8.1 Scan

- **Endpoint**: `https://api.openai.com/v1/chat/completions`
- **Model**: `gpt-4o-mini`
- **temperature**: `0.1`
- **response_format**: `{ "type": "json_object" }`

**system**

```text
You extract job requirements from job descriptions. Return strict JSON only.
```

**user**（`rawText` 截断 14000 字符后嵌入）

```text
Extract the job title, company, key requirements, and keywords from this job description.

Return this JSON shape:
{
  "jobTitle": "specific role title from the JD, not the website title",
  "company": "company name from the JD",
  "requirements": [
    {
      "text": "short requirement",
      "category": "skill | tool | experience | responsibility | qualification | other",
      "importance": "high | medium | low",
      "evidence": "exact supporting phrase from the job description"
    }
  ],
  "keywords": [
    {
      "text": "keyword",
      "category": "skill | tool | experience | responsibility | qualification | other",
      "importance": "high | medium | low",
      "evidence": "exact supporting phrase from the job description"
    }
  ],
  "confidence": 0.0
}

Rules:
- jobTitle must be the actual role, for example "Graduate Software Solutions Programmer/Consultant", not "SEEK" or a browser page title.
- company must be the hiring company from the JD.
- Keep requirements concrete and useful for tailoring a resume.
- Include technical tools, programming languages, work rights, location, responsibilities, and soft skills when important.
- Do not invent anything that is not supported by the JD.
- Limit requirements to 8 items.
- Limit keywords to 14 items.

Job description:
{{rawText}}
```

**解析**：`choices[0].message.content` → `JSON.parse` → 规范化（§8.3）。

---

### 8.2 Cover letter

- **Model**: `gpt-4o-mini`
- **temperature**: `0.45`
- **response_format**: `{ "type": "json_object" }`

**system**

```text
You write truthful, role-specific cover letters. Return strict JSON only with a single key "letter".
```

**user**（由扩展传入字段拼接，逻辑同 `openAiCoverLetterGenerator.ts`）

```text
Write a tailored cover letter for this role.

Job title: {{jobTitle}}
Company: {{company}}

Job description excerpt (for tone and facts only; do not invent duties the candidate did not do):
{{jdSnippet}}

{{keywordSection}}

{{requirementSection}}

Resume excerpts provided by the candidate (only use facts supported here; do not invent employers, dates, tools, or degrees):
{{resumeSection}}

Return strict JSON only in this shape:
{ "letter": "full cover letter body with paragraph breaks as \n" }

Rules:
- Professional, concise tone; roughly 220–360 words unless the excerpts are very thin.
- Connect selected requirements and keywords to the resume excerpts only where truthful.
- Do not fabricate experience, metrics, employers, degrees, or tools that are not implied by the excerpts.
- Do not include a subject line or "Dear Hiring Manager" placeholder unless you have a real recipient name in the data; "Dear Hiring Team" is acceptable.
- No markdown fences in the letter text; plain text with newlines only.
```

其中：

- `keywordSection`：有则 `Keywords the candidate wants to reflect (from the JD):\n- ...`，无则 `No keywords were selected.`
- `requirementSection`：同上，`Key requirements to address`
- `resumeSection`：有则 `### {heading}\n{body}` 多块，无则 `No resume excerpts were selected.`

**解析**：`{ "letter": string }`，trim 后为空 → `502 provider_error`。

---

### 8.3 规范化（必须从扩展复制行为）

来源：`openAiJobInsightsExtractor.ts`。

```typescript
const allowedCategories = [
  "skill", "tool", "experience", "responsibility", "qualification", "other",
] as const;

function makeId(prefix: string, text: string): string {
  return `${prefix}-${text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)}`;
}

// requirements: .slice(0, 8).map(item => normalize(item, "ai-requirement"))
// keywords:     .slice(0, 14).map(item => normalize(item, "ai-keyword"))
```

---

## 9. CORS

扩展 origin 为 `chrome-extension://<EXTENSION_ID>`（上架后 ID 固定）。

**MVP 可选策略**

1. **宽松（开发）**：`Access-Control-Allow-Origin: *` + 允许 `X-Device-Id`
2. **生产**：环境变量 `ALLOWED_ORIGINS=chrome-extension://xxxx` 白名单

预检 `OPTIONS` 需返回：

```http
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-Device-Id, X-Extension-Version
```

---

## 10. 环境变量

```bash
# .env.example
OPENAI_API_KEY=sk-...
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
PORT=3000
ALLOWED_ORIGINS=chrome-extension://your-extension-id
API_VERSION=1.0.0

# 配额（可覆盖默认值）
MONTHLY_BUDGET_USD=200
MONTHLY_BUDGET_WARN_USD=180
COST_ESTIMATE_SCAN_USD=0.004
COST_ESTIMATE_COVER_LETTER_USD=0.02
```

---

## 11. 扩展仓库联调清单（ai-resume，另一 Cursor 窗口）

后端就绪后，在 **扩展仓库** 做以下改动（本 MVP 可在后端完成后实施）：

| 项 | 文件 / 动作 |
|----|-------------|
| API Base URL 常量 | 新建 `src/shared/cloudApiConfig.ts` → `export const CLOUD_API_BASE = "https://api..."` |
| deviceId | 新建 `src/shared/deviceId.ts` → getOrCreate + `chrome.storage.local` |
| Scan 云端 | 新建 `src/infrastructure/ai/cloudScan.ts` 或扩展 `extractJobInsights` 分支 |
| Cover letter 云端 | 新建 `src/infrastructure/ai/cloudCoverLetter.ts` |
| Settings 默认 | 默认「Resume Tailor 免费 AI」；高级保留 BYOK（现有 `*WithAiProvider`） |
| manifest | `host_permissions` 增加 `https://api.<your-domain>/*` |
| Scan 无 Key | `App.tsx` `handleScanCurrentPage` 在 cloud 模式下不要求 `apiKey` |
| 错误映射 | 429/503 body → `setScanError(message)` / Results 页 `error` |
| 隐私政策 | `docs/privacy-policy.html` 写明经代理转发、不持久化 JD/简历 |

**扩展 Scan 流程（cloud 模式）**

```text
scanCurrentTab(readActiveTabText)  // 仍本地
POST /v1/scan { rawText }
merge → chrome.storage currentJobDescription
```

**扩展 Cover letter（cloud 模式）**

```text
POST /v1/cover-letter { jobTitle, company, jdSnippet, keywordLines, requirementLines, resumeBlocks }
→ CoverLetter { id: crypto.randomUUID(), content, createdAt }
```

---

## 12. 隐私与 Chrome Web Store

更新隐私政策（HTTPS 公开页），至少说明：

- 为提供免费 AI，**职位描述与简历摘录**会经你的 API **转发至 OpenAI** 处理。
- **不在服务器长期存储** 上述内容（MVP）。
- 使用 **匿名设备标识** 做配额，不收集姓名/邮箱（MVP）。
- 用户仍可在本机存储完整简历（`chrome.storage`）。

商店「数据使用」披露需与上述一致。

---

## 13. 测试建议

| 类型 | 内容 |
|------|------|
| 单元 | `makeId`、`parseOpenAiJson`、quota dayIndex |
| 集成 | mock OpenAI → scan/cover-letter 路由 |
| 手动 | curl + 固定 `X-Device-Id`；扩展 dev 加载 `dist` 联调 |
| 负载 | 同一 device 超限返回 429；global cost ≥ 200 返回 503 |

**curl 示例**

```bash
DEVICE_ID=$(uuidgen)
curl -s -X POST "$API/v1/scan" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: $DEVICE_ID" \
  -d '{"rawText":"We need Python and 2 years support experience. Company: Acme."}'
```

---

## 14. 部署检查清单

- [ ] HTTPS 证书有效
- [ ] `OPENAI_API_KEY` 仅服务端
- [ ] Redis 连通，键 TTL 正常
- [ ] CORS 含正式 `chrome-extension://` ID
- [ ] 监控：`global:cost:{month}` 日报（>150 USD 告警）
- [ ] 扩展新版本提交审核（新 `host_permissions`）

---

## 15. 源文件索引（扩展仓库）

复制 prompt / 逻辑时对照：

| 能力 | 扩展路径 |
|------|----------|
| Scan AI | `src/infrastructure/ai/openAiJobInsightsExtractor.ts` |
| Cover letter AI | `src/infrastructure/ai/openAiCoverLetterGenerator.ts` |
| Cover letter 组装 | `src/application/generateCoverLetter.ts` |
| Scan 合并 | `src/app/App.tsx` → `handleScanCurrentPage` |
| 领域类型 | `src/domain/jobDescription.ts`, `src/application/extractJobInsights.ts` |
| 错误文案 | `src/infrastructure/ai/aiProviderHttpError.ts` |
| 读 tab（仍本地） | `src/extension/tabs/readActiveTabText.ts` |
| Storage keys | `src/shared/storageKeys.ts` |

---

## 16. 新仓库快速启动命令（参考）

```bash
mkdir ai-resume-api && cd ai-resume-api
npm init -y
npm i hono @hono/node-server openai @upstash/redis zod
npm i -D typescript @types/node tsx
# 按 §4 建 src/，实现 §7–§8
# Railway: 连 GitHub，设 env，生成域名
```

---

## 17. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-05-20 | 初版：MVP Scan + Cover letter + deviceId + 7 日蜜月 + $200 月顶 |
| 2026-05-20 | 增加 §18–§22：自学方法、TS/框架学习顺序、12 步实现计划、调试清单 |

---

## 23. 新仓库建议附带文件

在 `ai-resume-api` 根目录自建（非必须，便于学习）：

| 文件 | 用途 |
|------|------|
| `LEARNING.md` | 每日 3 行笔记（§18.1） |
| `PROGRESS.md` | 勾选 Step 0–12 完成情况 |
| `.env.example` | 复制 §10，勿提交 `.env` |
| `scripts/test-openai.ts` | Step 5 前单独测 Key |

---

**下一步**

1. 新 Cursor 窗口：`Open Folder` → `ai-resume-api`。  
2. 从 **§21 Step 0** 开始，一天一步；规格查 **§7–§8**，卡住查 **§22**。  
3. 后端 Step 12 完成后，回扩展仓库按 **§11** 联调。  

需要自动生成 Step 0–1 脚手架时，在 API 仓库开 Agent 模式并引用本文档。
