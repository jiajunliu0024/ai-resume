# 会话归纳（压缩版）

本文档压缩记录与 **AI Resume** Chrome 扩展相关的一轮对话结论，便于换设备或给协作者快速对齐。实现细节以代码与下列专文为准。

| 专文 | 内容 |
|------|------|
| [RESUME_AI_PARSE.md](./RESUME_AI_PARSE.md) | 简历解析：PDF 页图 → OpenAI、本地 fallback、调用链 |
| [../AGENTS.md](../AGENTS.md) | 产品边界、隐私、目录分层、协作与验证约定 |

---

## 1. 产品方向（MVP）

- **本地优先** MV3 扩展：扫当前页 JD → 简历库（多 PDF）→ **Tailor** 结构化编辑 → Results / Cover letter 方向。
- **用户自带 API Key**，不写死后端；默认不落简历到自研服务器。
- 流程：**Scan → Resume（选/传 PDF）→ Tailor → Letter/Results**。

---

## 2. 架构原则

- **分层**：`app/` UI，`application/` 用例，`domain/` 类型与纯逻辑，`infrastructure/` Chrome / AI / 存储 / PDF，`extension/` 脚本与注入。
- **简历结构化**：以 **schema + domain + Tailor** 为主；不推荐用「整篇散文」替代结构化存储（可另做「全文导出/展示」层）。
- 详细解析管线见 [RESUME_AI_PARSE.md](./RESUME_AI_PARSE.md)。

---

## 3. 简历解析（重点结论）

### 3.1 OpenAI vs 本地

- **OpenAI + Key**：PDF 在本地 **渲染成页图（JPEG data URL）** 发给多模态模型，**不把 `extractTextFromPdf` 的纯文本塞进 AI 请求**；返回严格 JSON，再写入 `Resume`。
- **DeepSeek / 无 Key / AI 失败**：**本地** `extractTextFromPdf` + `parseResumeSections`（文本**仅**用于本地规则，不按当前产品策略发给 DeepSeek 做简历解析）。
- 调试时若 JSON 里出现 **`parseSource: "local"`**，说明是 **本地 fallback**，不是 vision AI 结果。

### 3.2 「二进制 vs 整图」

- 发给 API 的是 **整页光栅图** 的编码（如 base64 data URL），没有「只发二进制不发整图」的对立；准确度更多取决于分辨率、压缩、页数与模型。

### 3.3 本地解析器改进（针对典型 PDF）

- **经历**：合并「公司名单独行 + 下一条详情」；按 `◦/•` 拆 **achievements**；Volunteer + Holland 时尝试从正文抽 **Foundation** 作组织名。
- **教育**：`•` 分条时用 `parseEducationBulletChunk`；`The` + `University…` 断行用 `joinBrokenSchoolNameLines`。
- **解析版本**：`CURRENT_RESUME_PARSER_VERSION` 会随解析策略更新；旧库条目需 **重传或重解析** 才能对齐新规则。

---

## 4. UI / Tailor

- 各解析 **区块标题旁**：垃圾桶 = **整段清空**（Basic Info / Skills / Summary / Experience / Projects / Education / Certifications）。
- **每条经历 / 教育卡片**、**每个技能 chip**、**每条 achievement**：单独删除。
- **Skills 排版**：`skills-chip-list` + `inline-flex` 行内换行；去掉过窄 `max-width`，`field-sizing: content` + `size` 兜底，避免长技能被截成「Programming Langua…」。

---

## 5. 工程与仓库

- **`npm run verify`**：`eslint` + `tsc --noEmit` + `vite build`；`AGENTS.md` 约定有实质改动后跑一遍。
- **`ai_retreive.json`**：已加入 `.gitignore`（避免把解析调试/简历片段推上 Git）。
- **Git**：仓库曾 `git init` 后首次提交；推送到 GitHub 需在目标机配置 `remote` 与凭据（本环境无法代登录）。

---

## 6. 其他（Cursor 对话本身）

- **Cursor 聊天记录** 默认偏本地，**无**官方「整段对话自动同步到云端」；换设备可：复制要点进本文档 / 云笔记 / 仓库 `docs/`，或用社区导出工具（注意隐私）。

---

*若与当前代码不一致，以仓库内源码与 `AGENTS.md` 为准；本文件仅作会话级摘要。*
