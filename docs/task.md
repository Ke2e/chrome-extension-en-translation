# 任务拆分

> 基于 [需求文档](./proposal.md)、[技术架构文档](./design.md)、[弹窗页面布局](./Schematic%20diagram/示意图-弹窗页面.md)、[设置页面布局](./Schematic%20diagram/示意图-设置页面.md) 进行任务拆分。

---

## 阶段 1：项目脚手架搭建

### 任务 1：初始化项目与 Manifest 配置

**目标**：搭建可运行的 Chrome 扩展骨架，能够在 Chrome 中加载并识别。

**涉及文件**：

| 文件 | 说明 |
|------|------|
| `package.json` | 项目配置与依赖声明 |
| `tsconfig.json` | TypeScript 严格模式配置 |
| `vite.config.ts` | Vite + @crxjs/vite-plugin 构建配置 |
| `.prettierrc` | Prettier 代码格式化配置 |
| `.eslintrc.cjs` | ESLint 检查配置 |
| `public/manifest.json` | Chrome Manifest V3 清单文件 |
| `public/icons/` | 插件图标（16/48/128） |
| `src/popup/index.html` | 弹窗 HTML 入口（占位） |
| `src/options/index.html` | 设置页 HTML 入口（占位） |

**验收标准**：
- [ ] 执行 `npm run dev` 能正常启动构建
- [ ] 在 Chrome 中加载 `dist/` 目录后，扩展图标出现在工具栏
- [ ] 点击图标弹出空白弹窗（html 骨架）
- [ ] 右键图标 → 选项，打开空白设置页

**依赖**：无

**效果**：Chrome 工具栏出现插件图标，点击可弹出窗口。

---

### 任务 2：共享模块定义

**目标**：定义全局类型、常量和消息协议，为后续模块提供统一的类型基础。

**涉及文件**：

| 文件 | 说明 |
|------|------|
| `src/shared/types.ts` | 全局类型定义（TranslationResult, AppConfig, PopupState 等） |
| `src/shared/constants.ts` | 常量定义（DEFAULT_API_URL, DEFAULT_MODEL, STORAGE_KEYS 等） |
| `src/shared/messages.ts` | 消息协议定义（MessageType 枚举 + 各消息载荷类型） |

**消息协议定义**（参考 [design.md §5.2](file:///e:/ASUS/桌面/SDD/chrome-extension-en-translation/docs/design.md#L248-L260)）：

| 消息类型 | 方向 | 说明 |
|---------|------|------|
| `EXTRACT_CONTENT` | Popup → Content | 请求提取当前页面内容 |
| `CONTENT_RESULT` | Content → Popup | 返回提取后的 Markdown 原文 |
| `TRANSLATE_STREAM` | Popup → Background | 发起流式翻译请求 |
| `TRANSLATE_CHUNK` | Background → Popup | 流式翻译逐块返回 |
| `TRANSLATE_DONE` | Background → Popup | 翻译完成通知 |
| `TRANSLATE_ERROR` | Background → Popup | 翻译错误通知 |
| `TRANSLATE_CANCEL` | Popup → Background | 取消翻译 |
| `SAVE_RESULT` | Popup → Background | 保存翻译结果 |
| `LOAD_RESULT` | Popup → Background | 加载上次翻译结果 |

**验收标准**：
- [ ] TypeScript 编译通过，无类型错误
- [ ] 所有类型定义符合 [design.md §6.2](file:///e:/ASUS/桌面/SDD/chrome-extension-en-translation/docs/design.md#L312-L332) 的存储结构设计
- [ ] 消息类型枚举完整，覆盖 Popup ↔ Content ↔ Background 三端通信

**依赖**：任务 1

**效果**：类型系统就绪，后续模块可基于共享类型开发。

---

## 阶段 2：内容提取模块（Content Script）

### 任务 3：内容提取引擎实现

**目标**：实现 Content Script，使用 Defuddle 和 Readability 双引擎从网页中提取文章内容。

**涉及文件**：

| 文件 | 说明 |
|------|------|
| `src/content/content.ts` | Content Script 入口，监听消息并调用提取器 |
| `src/content/extractor/types.ts` | 提取结果类型定义（ExtractResult） |
| `src/content/extractor/defuddle-extractor.ts` | Defuddle 提取封装，解析 DOM 并提取标题、作者、正文 |
| `src/content/extractor/readability-extractor.ts` | Readability 提取封装，作为 Defuddle 的降级方案 |
| `src/content/extractor/index.ts` | 提取器入口：优先 Defuddle，失败时降级 Readability |

**参考示意图**：[示意图-弹窗页面.md §3](file:///e:/ASUS/桌面/SDD/chrome-extension-en-translation/docs/Schematic%20diagram/示意图-弹窗页面.md#L42-L67) - 提取中状态

**提取流程**（参考 [design.md §2.3](file:///e:/ASUS/桌面/SDD/chrome-extension-en-translation/docs/design.md#L74-L97)）：

```
Content Script 获取当前页面 DOM
        │
        ▼
尝试 Defuddle 解析
        │
        ├── 成功（内容非空）──► 提取元数据（标题、作者等）
        │
        └── 失败/内容为空 ──► 降级为 Readability 解析
                                    │
                                    ▼
                              提取元数据
        │
        ▼
将 HTML 结果传入 Turndown.js 转为 Markdown
        │
        ▼
返回 Markdown 原文给 Popup
```

**验收标准**：
- [ ] 能注入到任意网页，不干扰页面正常功能
- [ ] 成功提取文章标题、正文、作者（如有）
- [ ] 过滤掉导航栏、侧边栏、广告、页脚等非文章内容
- [ ] Defuddle 提取失败时自动降级到 Readability
- [ ] 对非文章页面（如视频页、搜索页）返回空结果，供 Popup 展示提示

**依赖**：任务 1、2

**效果**：将 Content Script 加载到网页后，可从多数英文文章中提取出干净的 HTML 内容。

---

### 任务 4：Markdown 转换与图片处理

**目标**：将提取引擎输出的 HTML 转换为 Markdown 格式，并处理图片 URL。

**涉及文件**：

| 文件 | 说明 |
|------|------|
| `src/content/converter/turndown.ts` | Turndown.js 配置，自定义规则（图片、链接、代码块等） |
| `src/content/converter/image-handler.ts` | 图片 URL 处理：相对路径 → 绝对路径，过滤无效图片 |

**Turndown 自定义规则**（参考 [design.md §2.4](file:///e:/ASUS/桌面/SDD/chrome-extension-en-translation/docs/design.md#L99-L101)）：

| 元素 | 转换规则 |
|------|---------|
| `<img>` | `![alt](src)`，保留 alt 文本，src 转为绝对 URL |
| `<a>` | `[text](url)`，text 保留原文，url 转为绝对 URL |
| `<pre><code>` | 代码块，保留原格式 |
| `<h1>~<h6>` | `#` ~ `######` 标题 |
| `<ul>/<ol>` | 列表，保留层级缩进 |
| `<blockquote>` | `>` 引用 |

**验收标准**：
- [ ] HTML 标题层级正确转换为 Markdown 标题
- [ ] 图片转换为 `![alt](src)` 格式，src 为绝对 URL
- [ ] 链接转换为 `[text](url)` 格式，url 为绝对 URL
- [ ] 代码块保留原格式和语言标记
- [ ] 列表、引用等基本排版结构完整保留
- [ ] 相对路径的图片/链接 URL 自动拼接为绝对 URL

**依赖**：任务 3

**效果**：提取的 HTML 内容能正确转换为标准 Markdown 格式，图片和链接可正常显示。

---

## 阶段 3：后台服务模块（Service Worker）

### 任务 5：翻译服务实现

**目标**：实现 Service Worker，通过 OpenAI SDK 兼容接口调用 Qwen 模型进行流式翻译。

**涉及文件**：

| 文件 | 说明 |
|------|------|
| `src/background/background.ts` | Service Worker 入口，消息路由分发 |
| `src/background/translator.ts` | 翻译服务，封装 OpenAI SDK 的 Streaming 调用 |

**翻译流程**（参考 [design.md §3.3](file:///e:/ASUS/桌面/SDD/chrome-extension-en-translation/docs/design.md#L125-L144)）：

```
接收 TRANSLATE_STREAM 消息（含 Markdown 原文）
        │
        ▼
从 storage 读取 API Key / API 地址 / 模型名称
        │
        ▼
构造 System Prompt + User Prompt
        │
        ▼
通过 OpenAI SDK 发起 Streaming 请求
        │
        ▼
逐 chunk 通过 TRANSLATE_CHUNK 消息发送给 Popup
        │
        ▼
完成后发送 TRANSLATE_DONE / 出错发送 TRANSLATE_ERROR
```

**System Prompt 核心要点**（参考 [design.md §3.4](file:///e:/ASUS/桌面/SDD/chrome-extension-en-translation/docs/design.md#L146-L155)）：

- 将英文翻译为中文
- 保留所有 Markdown 格式标记
- 不翻译代码块中的内容
- 图片 alt 文本需翻译，src 保持原样
- 链接 text 需翻译，url 保持原样

**输出格式要求**（参考 [proposal.md §2.5](file:///e:/ASUS/桌面/SDD/chrome-extension-en-translation/docs/proposal.md#L56-L74)）：

```
# [文章标题]

> **作者**: [作者名]
> **原文链接**: [原始文章 URL]

[翻译后的正文]
```

**验收标准**：
- [ ] Service Worker 成功注册，无运行时错误
- [ ] 能正确接收并路由 TRANSLATE_STREAM 消息
- [ ] 支持 Streaming 方式逐块返回翻译结果
- [ ] 翻译结果保留原文 Markdown 格式标记
- [ ] 支持取消翻译（TRANSLATE_CANCEL 消息）
- [ ] 网络错误 / API Key 无效 / 模型不可用 时返回 TRANSLATE_ERROR

**依赖**：任务 1、2

**效果**：Service Worker 就绪，可通过消息驱动发起流式翻译，翻译结果逐块返回。

---

### 任务 6：本地存储服务实现

**目标**：封装 Chrome Storage API，实现翻译结果的持久化存储与读取。

**涉及文件**：

| 文件 | 说明 |
|------|------|
| `src/background/storage.ts` | Chrome Storage 读写封装，提供 save/load/clear 方法 |

**存储结构**（参考 [design.md §6.2](file:///e:/ASUS/桌面/SDD/chrome-extension-en-translation/docs/design.md#L312-L332)）：

| 键名 | 值类型 | 说明 |
|------|--------|------|
| `lastTranslation` | `TranslationResult` | 最近一次完整翻译结果 |
| `appConfig` | `AppConfig` | 用户配置（API Key、地址、模型等） |

**TranslationResult 结构**：

```typescript
interface TranslationResult {
  title: string;
  author: string;
  originalUrl: string;
  originalMarkdown: string;
  translatedMarkdown: string;
  translatedAt: number;
}
```

**验收标准**：
- [ ] `saveTranslation()` 成功将翻译结果写入 `chrome.storage.local`
- [ ] `loadTranslation()` 正确读取上次翻译结果，无结果时返回 null
- [ ] `clearTranslation()` 清除存储的翻译结果
- [ ] 每次新翻译完成后，覆盖上一次存储（不保留历史记录）
- [ ] `saveConfig()` / `loadConfig()` / `clearConfig()` 读写 AppConfig

**依赖**：任务 1、2

**效果**：存储服务就绪，可在 Popup 打开时恢复上次翻译结果。

---

## 阶段 4：弹窗 UI（Popup）

### 任务 7：弹窗基础框架与状态管理

**目标**：搭建弹窗 React 应用，实现 5 种状态的切换管理和 StatusBar 组件。

**涉及文件**：

| 文件 | 说明 |
|------|------|
| `src/popup/main.tsx` | 弹窗 React 入口 |
| `src/popup/App.tsx` | 弹窗主组件，管理 idle/extracting/translating/done/error 五种状态 |
| `src/popup/components/StatusBar.tsx` | 状态栏组件，根据状态显示不同图标和文字 |
| `src/popup/styles/popup.css` | 弹窗全局样式 |

**五种状态对应的 StatusBar 显示**（参考 [示意图-弹窗页面.md](file:///e:/ASUS/桌面/SDD/chrome-extension-en-translation/docs/Schematic%20diagram/示意图-弹窗页面.md)）：

| 状态 | StatusBar 显示 | 示意图章节 |
|------|---------------|-----------|
| `idle` | 仅标题栏"◇ 网页翻译助手" | [§2 空状态](file:///e:/ASUS/桌面/SDD/chrome-extension-en-translation/docs/Schematic%20diagram/示意图-弹窗页面.md#L11-L38) |
| `extracting` | "⏳ 正在提取文章内容..." + 进度条 | [§3 提取中](file:///e:/ASUS/桌面/SDD/chrome-extension-en-translation/docs/Schematic%20diagram/示意图-弹窗页面.md#L42-L67) |
| `translating` | "✅ 文章提取完成 \| 📝 正在翻译..." | [§4 翻译中](file:///e:/ASUS/桌面/SDD/chrome-extension-en-translation/docs/Schematic%20diagram/示意图-弹窗页面.md#L70-L108) |
| `done` | "✅ 翻译完成 \| 共 N 字" | [§5 完成](file:///e:/ASUS/桌面/SDD/chrome-extension-en-translation/docs/Schematic%20diagram/示意图-弹窗页面.md#L111-L155) |
| `error` | "❌ 翻译失败" + 错误原因 | [§6 错误](file:///e:/ASUS/桌面/SDD/chrome-extension-en-translation/docs/Schematic%20diagram/示意图-弹窗页面.md#L158-L191) |

**状态流转**（参考 [示意图-弹窗页面.md §9](file:///e:/ASUS/桌面/SDD/chrome-extension-en-translation/docs/Schematic%20diagram/示意图-弹窗页面.md#L234-L265)）：

```
idle ──► extracting ──► translating ──► done
                                  │          │
                                  ▼          │
                               error ◄───────┘
                                  ▲
                                  │
                               (重新翻译)
```

**验收标准**：
- [ ] 弹窗打开时显示空状态（idle），中央显示"翻译当前页面"按钮
- [ ] 通过模拟状态切换，能依次看到 extracting → translating → done → error 各状态
- [ ] StatusBar 在每个状态下显示正确的图标和文字
- [ ] 弹窗宽度 420px，高度自适应，最大 600px
- [ ] 底部"设置"入口可点击

**依赖**：任务 1、2

**效果**：弹窗可正常打开，状态切换可见，UI 框架搭建完成。

---

### 任务 8：翻译展示与交互组件

**目标**：集成 md-wx 组件展示翻译结果，实现打字机效果、复制、下载、重新翻译等交互功能。

**涉及文件**：

| 文件 | 说明 |
|------|------|
| `src/popup/components/TranslationView.tsx` | 翻译结果展示区，集成 md-wx MarkdownRenderer |
| `src/popup/components/ActionButtons.tsx` | 操作按钮区，根据状态显示不同按钮组合 |

**md-wx 配置**（参考 [design.md §7.2](file:///e:/ASUS/桌面/SDD/chrome-extension-en-translation/docs/design.md#L352-L361)）：

| 配置项 | 值 |
|-------|-----|
| `showSettings` | `false` |
| `enableCopy` | `true`（由 ActionButtons 接管，md-wx 内禁用） |
| `enableThemeSwitch` | `false` |
| `enableViewModeToggle` | `false` |
| `defaultViewMode` | `'mobile'` |

**打字机效果实现**（参考 [design.md §7.3](file:///e:/ASUS/桌面/SDD/chrome-extension-en-translation/docs/design.md#L363-L370)）：

```
Background 逐 chunk 返回 TRANSLATE_CHUNK
        │
        ▼
App.tsx 维护缓冲区字符串，追加新 chunk
        │
        ▼
将缓冲区最新字符串作为 markdown prop 传入 MarkdownRenderer
        │
        ▼
React diff 机制触发增量渲染
```

**按钮组合**（参考 [示意图-弹窗页面.md §7](file:///e:/ASUS/桌面/SDD/chrome-extension-en-translation/docs/Schematic%20diagram/示意图-弹窗页面.md#L194-L213)）：

| 状态 | 按钮 |
|------|------|
| `idle` | 无（仅中央"翻译当前页面"按钮） |
| `extracting` | 无 |
| `translating` | 📋 复制 / 🔄 重新翻译 / ✋ 取消 |
| `done` | 📋 复制 / 🔄 重新翻译 / ⬇ 下载 Markdown |
| `error` | 🔄 重新翻译 / ⚙ 前往设置 |

**验收标准**：
- [ ] md-wx 包正确安装，MarkdownRenderer 组件正常渲染
- [ ] 翻译结果以打字机效果逐段展示，光标闪烁
- [ ] 复制按钮将翻译结果复制到剪贴板
- [ ] 下载按钮生成 `.md` 文件并触发下载
- [ ] 重新翻译按钮重置状态，重新发起提取流程
- [ ] 取消按钮中断正在进行的翻译
- [ ] 长内容可滚动查看

**依赖**：任务 7

**效果**：弹窗具备完整的翻译展示和交互能力，打字机效果动态展示翻译结果。

---

## 阶段 5：设置页面（Options）

### 任务 9：设置页面实现

**目标**：实现设置页面，提供 API Key、API 地址、模型名称、系统提示词的配置能力。

**涉及文件**：

| 文件 | 说明 |
|------|------|
| `src/options/main.tsx` | 设置页 React 入口 |
| `src/options/components/SettingsForm.tsx` | 设置表单主组件，包含所有配置项 |
| `src/options/styles/options.css` | 设置页样式 |

**页面布局**（参考 [示意图-设置页面.md §2](file:///e:/ASUS/桌面/SDD/chrome-extension-en-translation/docs/Schematic%20diagram/示意图-设置页面.md#L9-L70)）：

```
┌──────────────────────────────────────────────────────────────┐
│  ◈ 网页翻译助手 · 设置                                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─ AI 模型配置 ────────────────────────────────────────────┐│
│  │  API Key     [········································]   ││
│  │  API 地址    [https://dashscope.aliyuncs.com/...]        ││
│  │  模型名称    [qwen-turbo                               ]  ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─ 翻译设置 ───────────────────────────────────────────────┐│
│  │  系统提示词                                               ││
│  │  ┌──────────────────────────────────────────────────────┐││
│  │  │ 你是一个专业的翻译助手...                              │││
│  │  └──────────────────────────────────────────────────────┘││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─ 关于 ───────────────────────────────────────────────────┐│
│  │  版本号：v1.0.0                                          ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│         ┌──────────────┐    ┌──────────────┐                  │
│         │   保存设置    │    │   恢复默认    │                 │
│         └──────────────┘    └──────────────┘                  │
│                                                              │
│  ✅ 设置已保存                                                │
└──────────────────────────────────────────────────────────────┘
```

**配置项**（参考 [示意图-设置页面.md §3](file:///e:/ASUS/桌面/SDD/chrome-extension-en-translation/docs/Schematic%20diagram/示意图-设置页面.md#L74-L92)）：

| 字段 | 输入类型 | 默认值 | 校验规则 |
|------|---------|--------|---------|
| API Key | `type="password"` | 空 | 非空 |
| API 地址 | 文本输入框 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 非空 + 合法 URL |
| 模型名称 | 文本输入框 | `qwen-turbo` | 非空 |
| 系统提示词 | textarea | 内置默认提示词 | 可选 |

**验收标准**：
- [ ] 在弹窗中点击"设置"可打开设置页
- [ ] 所有配置项输入框正常渲染，API Key 为密码模式
- [ ] 输入校验生效：空值/非法 URL 时显示错误提示
- [ ] 点击"保存设置"后，配置持久化到 `chrome.storage.local`
- [ ] 重新打开设置页，已保存的配置自动回填
- [ ] 点击"恢复默认"，所有字段恢复默认值
- [ ] 保存成功后显示"✅ 设置已保存"提示

**依赖**：任务 1、2

**效果**：用户可在设置页中配置 API Key 等信息，配置持久化保存。

---

## 阶段 6：集成与完善

### 任务 10：模块集成与端到端联调

**目标**：将 Popup、Content Script、Background 三端串联，跑通完整翻译流程。

**涉及文件**：

| 文件 | 说明 |
|------|------|
| `src/popup/App.tsx` | 集成消息通信，连接 Content Script 和 Background |
| `src/background/background.ts` | 完善消息路由，处理所有消息类型 |
| `src/content/content.ts` | 完善消息监听与响应 |

**完整数据流**（参考 [design.md §6.1](file:///e:/ASUS/桌面/SDD/chrome-extension-en-translation/docs/design.md#L264-L310)）：

```
用户点击插件图标 → Popup 打开
    → 检查 storage 是否有上次结果
    → 有：展示上次结果 / 无：显示空状态

用户点击"翻译当前页面"
    → Popup 发送 EXTRACT_CONTENT → Content Script
    → Content Script 提取 + 转换 → 返回 Markdown 原文
    → Popup 显示"提取完成"，发送 TRANSLATE_STREAM → Background
    → Background 发起 Streaming 翻译 → 逐块返回 TRANSLATE_CHUNK
    → Popup 逐块更新 md-wx 组件（打字机效果）
    → 翻译完成 → Background 保存结果 → Popup 显示"翻译完成"
```

**输出格式验证**（参考 [proposal.md §2.5](file:///e:/ASUS/桌面/SDD/chrome-extension-en-translation/docs/proposal.md#L56-L74)）：

```
# [文章标题]

> **作者**: [作者名]
> **原文链接**: [原始文章 URL]

[翻译后的正文]
```

**验收标准**：
- [ ] 打开英文网页 → 点击插件 → 提取内容 → 翻译 → 展示，全流程跑通
- [ ] 翻译结果严格遵循要求的输出格式
- [ ] 原文中的图片以 `![alt](src)` 格式保留
- [ ] 打字机效果流畅，不卡顿
- [ ] 重新打开弹窗，上次翻译结果自动恢复
- [ ] 取消翻译后，可正常发起新的翻译
- [ ] 下载 Markdown 文件内容与展示内容一致

**依赖**：任务 4、5、6、8、9

**效果**：插件完整可用，用户可一键完成"提取 → 翻译 → 展示 → 保存"全流程。

---

### 任务 11：错误处理与边界情况完善

**目标**：完善所有异常场景的处理，提升插件的健壮性和用户体验。

**涉及文件**：

| 文件 | 说明 |
|------|------|
| `src/popup/App.tsx` | 错误状态展示与用户引导 |
| `src/background/translator.ts` | 翻译错误分类处理 |
| `src/content/content.ts` | 提取失败处理 |
| `src/popup/components/ActionButtons.tsx` | 错误状态下的按钮逻辑 |

**需处理的异常场景**（参考 [design.md §3.5](file:///e:/ASUS/桌面/SDD/chrome-extension-en-translation/docs/design.md#L156-L161)）：

| 场景 | 处理方式 |
|------|---------|
| API Key 未配置 | 弹窗显示"请前往设置页配置 API Key"，提供"前往设置"按钮 |
| API Key 无效 | 弹窗显示"API Key 无效"，引导用户检查设置 |
| 网络错误 | 弹窗显示"网络连接失败，请检查网络后重试" |
| 速率限制 | 弹窗显示"请求过于频繁，请稍后重试" |
| 模型不可用 | 弹窗显示"模型不可用，请检查模型名称配置" |
| 页面不支持提取 | 弹窗显示"当前页面无法提取文章内容" |
| 提取内容为空 | 弹窗显示"未在页面中找到文章内容" |
| 翻译中途取消 | 展示已翻译的部分，不报错 |

**验收标准**：
- [ ] 未配置 API Key 时给出明确引导
- [ ] API Key 无效时给出友好提示
- [ ] 网络断开时提示检查网络
- [ ] 非文章页面给出明确提示
- [ ] 所有错误场景均不崩溃，用户可继续操作
- [ ] 错误状态下提供"重新翻译"或"前往设置"的操作入口

**依赖**：任务 10

**效果**：插件在各种异常场景下表现稳定，用户体验良好。

---

## 任务依赖关系总览

```
任务 1 (项目脚手架)
    │
    ├──► 任务 2 (共享模块)
    │         │
    │         ├──► 任务 3 (内容提取引擎) ──► 任务 4 (Markdown 转换)
    │         │
    │         ├──► 任务 5 (翻译服务) ──► 任务 6 (存储服务)
    │         │
    │         ├──► 任务 7 (弹窗基础框架) ──► 任务 8 (翻译展示与交互)
    │         │
    │         └──► 任务 9 (设置页面)
    │
    ├──► 任务 10 (模块集成联调)
    │         │
    │         └──► 任务 11 (错误处理完善)
    │
    └── 共 11 个任务，6 个阶段
```

**并行说明**：任务 3/4、任务 5/6、任务 7/8、任务 9 之间无依赖关系，可并行开发。但按 AI 分步实现建议顺序执行，每个任务完成后均可验证阶段性效果。

## 任务优先级

| 优先级 | 任务 | 说明 |
|--------|------|------|
| P0 | 任务 1、2 | 基础骨架，所有模块依赖 |
| P0 | 任务 3、4 | 核心能力：内容提取 |
| P0 | 任务 5、6 | 核心能力：翻译与存储 |
| P0 | 任务 7、8 | 核心能力：弹窗交互 |
| P0 | 任务 9 | 核心能力：配置管理 |
| P0 | 任务 10 | 核心能力：端到端流程 |
| P1 | 任务 11 | 完善：错误处理 |