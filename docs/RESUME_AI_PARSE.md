# PDF 简历解析、去重、Tailor 分区与 Chrome 存储

本文说明：从用户选择 PDF 到得到结构化数据、去重、Tailor 动态分区展示，以及如何通过 `chrome.storage.local` 持久化以便**复用已解析结果**（后续浏览 Tailor / 编辑简历**不需要再次调用解析 API**，除非用户重新上传或主动触发重新解析）。

---

## 1. 关于 `ai_retreive.json` 里 achievements「最后一句重复」

### 1.1 先看元数据：这不是「部署 AI 解析」路径

若 JSON 中出现：

- `"parseSource": "local"`
- `"parseStatus": "fallback"`

则表示该文件来自 **本地 PDF 文本提取 + 启发式分段**（`extractTextFromPdf` → `parseResumeSections`），**不是** OpenAI 多模态页图解析路径。  
若使用 **OpenAI vision** 或 **DeepSeek 文本解析** 且请求成功，通常会看到 `parseSource: "ai"`、`parseStatus: "parsed"`。

因此：**你手里的这份样例，重复问题主要来自本地解析链路与 PDF 文本层，而不是「线上部署的 AI 服务」单独出错。**（若走 AI 路径，模型仍可能输出近似重复 bullet，但机制不同，见下文。）

### 1.2 为何常表现为「最后一条 bullet 连着两条几乎一样」

常见成因组合：

1. **PDF 文本层（pdf.js）**  
   同一句话可能因排版、换行、或不同 text run，被拆成两行或出现「一行无句点、下一行同句加句点」等形态。

2. **本地经历解析把「每一行」当成一条 achievement**  
   在 `parseExperienceItems` 中，经历块里日期/标题之后的行会进入 `achievements` 数组（见 `parseResumeSections.ts` 中对 `block.slice(detailStartIndex)` 的处理）。若 PDF 在同一 bullet 上输出了两行极相似文本，就会得到两条数组元素。

3. **早期去重是「整串精确匹配」**  
   `dedupeAchievementList` 曾对 `"...Hub"` 与 `"...Hub."` 视为不同 key，无法合并。当前实现已增加 **去掉句末 `.`/`!`/`?` 后的 soft key**，用于合并这类「仅差标点」的重复（见 `src/shared/experienceAchievements.ts`）。

4. **`stripAchievementTrailingRoleLine`**  
   用于去掉误粘在 bullet 末尾的 **职位名/地点**（例如把标题又拼进最后一句），与「整句复制两遍」是另一类问题，互补使用。

---

## 2. (a) 方法链调用：从上传到 API（或本地）再到 `Resume`

### 2.1 UI 入口

| 步骤 | 位置 | 说明 |
|------|------|------|
| 用户选文件 | `ResumePage.handleFileChange` | 校验 PDF，`parseResume(file.name, file, { apiKey, aiProvider })` |

### 2.2 应用编排：`parseResume`

文件：`src/application/parseResume.ts`

并行执行：

1. `extractTextFromPdf(file)` → 始终尝试得到 **纯文本**（供本地解析与 `rawText` 兜底）。
2. 若 `apiKey` 非空且提供商为 **OpenAI**，则 `renderPdfPagesToImageDataUrls(file, …)` 将 PDF **栅格化为 JPEG data URL**（最多页数、宽度上限等见代码）。**DeepSeek** 不跑页图渲染，仅用下面第 1 步得到的 `rawText`。

分支（按顺序）：

- **OpenAI + Vision 成功**  
  `parseResumeWithAiProviderFromPdfPageImages(pageImages, apiKey, "openai")`  
  → `fetch` OpenAI `chat/completions`（多模态：说明 + 页图，**不把提取的 PDF 正文放进该请求**）  
  → `normalizeAiResumeJson` → `buildResume(..., "ai")`

- **DeepSeek + 有 Key 且 `rawText` 非空**  
  `parseResumeWithAiProviderFromPlainText(rawText, apiKey, "deepseek")`  
  → `fetch` DeepSeek `chat/completions`（**用户 PDF 提取出的纯文本** + JSON 结构说明；与 Scan 页同一类直连调用）  
  → `normalizeAiResumeJson` → `buildResume(..., "ai")`  
  若请求失败则退回本地 `parseResumeSections`。

- **否则**  
  若 `rawText` 非空：`parseResumeSections(rawText)` → `buildResume(..., "local")`  
  若文本也为空：抛错（扫描版 PDF 需 OpenAI vision 或换可提取文本的 PDF）。

### 2.3 本地分段：`parseResumeSections`

文件：`src/application/parseResumeSections.ts`

对整份简历纯文本：按标题别名切 `EXPERIENCE` / `EDUCATION` 等区块，其中经历使用 `splitRoleBlocks`、`parseExperienceItems`、`mergeAdjacentCompanyStubs`、`refineExperienceAchievements`，最后对每条 `experienceItems` 调用 **`finalizeExperienceAchievements`**。

### 2.4 AI 归一化：`normalizeAiResumeJson`

文件：`src/infrastructure/ai/aiResumeParser.ts`

解析模型返回的 JSON，规范化字段类型与数组，并对每条经历的 `achievements` 同样走 **`finalizeExperienceAchievements`**，与本地路径对齐。

### 2.5 汇总为领域对象：`buildResume`

同一 `Resume` 形状写入 `id`、`title`、`rawText`、各 section 字符串与 `*Items` 数组、`parseSource`、`parseStatus`、`parserVersion`、`parsedAt` 等（见 `src/domain/resume.ts`）。

---

## 3. (b) 去重与整理用了哪些手段

所有经历 bullet 的最终整理入口：**`finalizeExperienceAchievements`**（`src/shared/experienceAchievements.ts`），在以下位置调用：

| 调用点 | 作用 |
|--------|------|
| `parseResumeSections.ts` → `parseExperienceItems` 末尾 | 本地解析完每条经历后 |
| `aiResumeParser.ts` → `normalizeAiResumeJson` | AI JSON 映射到 `experienceItems` 时 |
| `TailorPage.tsx` → `enrichResumeSections` | 打开 Tailor 时对已存简历再跑一遍，修正历史数据中的重复与尾部粘连 |

内部步骤：

1. **`stripAchievementTrailingRoleLine(line, title, location)`**  
   若句末误粘了与当前条目一致的 `title`、`location` 或其组合，则裁掉，减轻 PDF 合并行导致的垃圾尾缀。

2. **空白规范化 + 过短行过滤**  
   `replace(/\s+/g, " ").trim()`，长度阈值过滤碎片。

3. **`dedupeAchievementList`**  
   - 先做 **完全重复**（规范化后整串小写一致）的排除。  
   - 使用 **`achievementSoftDedupeKey`**：去掉句末 `.` / `!` / `?` 再比较小写，合并「仅差句末标点」的两行，并倾向保留更长、或带句点的版本。

---

## 4. (c) 返回数据如何「动态」决定 Tailor 里有哪些 section

Tailor 不硬编码固定区块列表，而是根据 **`Resume` + 技能拆条** 计算可见分区。

文件：`src/app/pages/tailorSectionModel.ts` → **`getVisibleTailorSections(resume, skillChips)`**

逻辑概要：

- **始终**：`basicInfo`
- **Skills**：`skillChips.length > 0` 或 `resume.skills` 非空
- **Summary**：`resume.summary` 有内容
- **Experience**：`experienceHasContent(resume)`（`experience` 文本或任一 `experienceItems` 有实质字段）
- **Projects**：`projectsHasContent(resume)`
- **Education**：`educationHasContent(resume)`
- **Certifications**：`resume.certifications` 有内容

`TailorPage` 将 `visibleTailorSections` 传给 `TailorSectionPanels`，只渲染返回的 section id，从而实现「有数据才出现对应卡片」。

---

## 5. (d) Chrome storage：如何保存、复用、何时不必再耗 API Key

### 5.1 抽象层

`src/infrastructure/storage/chromeStorageRepository.ts` 封装 `chrome.storage.local.get/set/remove`，便于测试或以后替换存储后端。

### 5.2 键名（`src/shared/storageKeys.ts`）

| Key | 含义 |
|-----|------|
| `resume-tailor.api-key` | 用户 API Key（仅本地） |
| `resume-tailor.ai-provider` | 选中的提供商 id |
| `resume-tailor.current-resume` | 当前选中的 **`Resume` 整对象**（含已解析字段） |
| `resume-tailor.resumes` | 简历库 **`Resume[]`** |
| `resume-tailor.current-job-description` | 当前扫描的职位/JD 结果 |
| `resume-tailor.current-results` | 生成结果等 |

### 5.3 写入时机（`src/app/App.tsx`）

- **`handleResumesAdd`**：`ResumePage` 上传解析完成后追加列表，并把 **第一份** 设为 `currentResume`，同时 `setItem(resumes)`、`setItem(currentResume)`。  
  **解析只在此次上传发生一次**；之后数据在内存与 storage 中已是结构化 `Resume`。

- **`handleResumeChange`**：Tailor 或其它页编辑后更新 `currentResume`，并把同 id 简历同步到 `resumes` 数组再 `setItem`。

- **`handleResumeSelect`**：从列表切换当前简历，写回 `currentResume`。

- **`handleResumeDelete`**：更新 `resumes`，必要时清空或切换 `currentResume`。

### 5.4 「不需要再调 API Key」的含义

- **已解析的 `Resume`**（含 `experienceItems`、`basicInfoFields` 等）保存在 **`currentResume` / `resumes`**。用户之后打开 **Resume / Tailor**，读的是 **React 状态 + storage**，**不会**为展示 Tailor 再次调用 OpenAI 解析 PDF。  
- **仍会用到 API Key 的场景**（与解析无关）：例如 **Scan 页** 对职位描述做 AI 抽取（`extractJobInsightsWithAiProvider`）等，除非产品改为纯本地。

### 5.5 清除数据

设置里的 Clear Local Data 会移除 `currentJobDescription`、`currentResume`、`resumes`、`currentResults` 等（**不**默认清除用户自愿保存的 `apiKey`，具体以 `App.tsx` 中 `handleClearLocalData` 为准）。

---

## 6. 关键文件索引

| 文件 | 职责 |
|------|------|
| `src/app/pages/ResumePage.tsx` | 上传、调用 `parseResume`、提示文案 |
| `src/application/parseResume.ts` | PDF 并行提取文本 + 可选 vision；`buildResume` |
| `src/infrastructure/parser/pdfResumeParser.ts` | `extractTextFromPdf`、`renderPdfPagesToImageDataUrls` |
| `src/infrastructure/ai/aiResumeParser.ts` | OpenAI 页图 vision、`parseResumeWithAiProviderFromPlainText`（DeepSeek 文本）、`normalizeAiResumeJson` |
| `src/application/parseResumeSections.ts` | 本地启发式解析 |
| `src/shared/experienceAchievements.ts` | 经历 bullet 去重与尾部清理 |
| `src/domain/resume.ts` | `Resume` 类型定义 |
| `src/app/pages/tailorSectionModel.ts` | Tailor 可见 section 计算 |
| `src/app/pages/TailorPage.tsx` | `enrichResumeSections`、编辑回写 |
| `src/shared/storageKeys.ts` | storage 键常量 |

---

## 7. 隐私说明（摘要）

- PDF **二进制**不会上传到项目自有后端。  
- **OpenAI vision**：浏览器把 **页图 + 提示** 发到用户 **OpenAI** API（不把提取的 PDF 正文放进该请求）。  
- **DeepSeek**：浏览器把 **PDF 提取出的纯文本 + 提示** 发到用户 **DeepSeek** API（与 Scan 页「自带 Key 直连提供商」一致）。  
- **纯本地**：文本仅在浏览器内规则解析，可写入 `chrome.storage.local`。  
- 详见仓库 `AGENTS.md`。

---

## 8. 版本号

`Resume.parserVersion` 使用 `CURRENT_RESUME_PARSER_VERSION`（`parseResume.ts`）。修改解析语义时可 bump，用于 `isResumeParsed` 等门禁逻辑。
