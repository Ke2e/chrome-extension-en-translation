# Chrome 翻译插件 —— 技术架构文档

## 1. 技术选型总览

### 1.1 技术栈

| 层次 | 技术方案 | 说明 |
|------|---------|------|
| 扩展框架 | Chrome Manifest V3 | Chrome 扩展最新规范 |
| 前端框架 | React 18 | 构建插件弹窗 UI |
| 构建工具 | Vite + @crxjs/vite-plugin | 专为 Chrome 扩展优化的构建方案 |
| 内容提取 | Defuddle（主）+ Mozilla Readability（备） | 文章内容提取与 HTML 净化 |
| HTML 转 Markdown | Turndown.js | 将提取后的 HTML 转为 Markdown |
| AI 翻译 | OpenAI SDK 兼容接口 | 通过标准 OpenAI SDK 调用 Qwen 等模型 |
| 翻译结果展示 | md-wx（npm package） | 渲染 Markdown 格式的翻译结果 |
| 本地持久化 | Chrome Storage API（chrome.storage.local） | 存储最近一次翻译结果 |
| 包管理 | npm | 依赖管理 |
| 语言 | TypeScript | 全栈类型安全 |

### 1.2 架构分层

```
┌──────────────────────────────────────────────┐
│                   Popup UI                    │
│         (React + md-wx 组件展示层)              │
├──────────────────────────────────────────────┤
│               业务逻辑层                       │
│   ┌─────────┐ ┌──────────┐ ┌──────────────┐  │
│   │ 内容提取  │ │ AI 翻译   │ │ 结果持久化    │  │
│   │ 模块     │ │ 模块      │ │ 模块         │  │
│   └─────────┘ └──────────┘ └──────────────┘  │
├──────────────────────────────────────────────┤
│                Content Script                │
│   (Defuddle + Readability + Turndown.js)     │
├──────────────────────────────────────────────┤
│               Service Worker                 │
│     (API 请求代理、Storage 管理)                │
├──────────────────────────────────────────────┤
│              Chrome Extensions API           │
└──────────────────────────────────────────────┘
```

## 2. 内容提取技术方案

### 2.1 方案调研结论

内容提取是插件的核心难点。经调研，目前业界主流方案对比如下：

| 方案 | 维护方 | 优势 | 劣势 |
|------|-------|------|------|
| Mozilla Readability | Mozilla | 久经考验，Firefox 阅读模式同款，社区成熟 | 提取偏保守，可能遗漏部分内容；元数据提取有限 |
| Defuddle | kepano（Obsidian 作者） | 提取更宽容，保留更多内容；内建 schema.org 元数据提取；输出 HTML 标准化（脚注、代码块、数学公式）；支持 Markdown 直接输出 | 较新，生态相对年轻 |
| @extractus/article-extractor | 社区 | 支持多种元数据提取 | 体积较大，更新频率低 |
| 自建 DOM 解析 | — | 完全可控 | 开发成本高，维护困难 |

### 2.2 推荐方案：Defuddle（主）+ Readability（备）

采用 **Defuddle 为主、Mozilla Readability 为降级备选** 的双引擎策略：

**主引擎 —— Defuddle**（版本：latest）

- 由 Obsidian 作者 kepano 开发，专为网页剪藏场景设计
- 提取更宽容，不会因为不确定而过度删除内容
- 自动提取 schema.org 结构化数据，可获得作者、发布日期、封面图等元数据
- 内置 HTML 标准化，对脚注、代码块、数学公式等元素输出格式一致
- 支持直接输出 Markdown，减少转换环节
- 已有成功案例：Obsidian Web Clipper、Page to Markdown 等

**备引擎 —— Mozilla Readability**（版本：@mozilla/readability）

- 当 Defuddle 提取结果为空或质量过低时自动降级
- 作为成熟兜底方案，覆盖 Defuddle 未能处理的页面

### 2.3 提取流程

```
用户点击插件图标
        │
        ▼
Content Script 获取当前页面 DOM
        │
        ▼
尝试 Defuddle 解析
        │
        ├── 成功（内容非空）───► 提取元数据（标题、作者、封面图等）
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
返回 Markdown 原文给 Popup 进行翻译
```

### 2.4 图片处理

Defuddle 和 Readability 均会保留文章内的 `<img>` 标签。在 Turndown.js 转换时，通过自定义规则将 `<img>` 转换为 `![alt](src)` 格式。对于相对路径的图片，需要拼接为绝对 URL。

## 3. AI 翻译方案

### 3.1 架构设计

采用 OpenAI SDK 兼容接口，确保模型可切换性。

**选用 OpenAI SDK 的原因：**

- 标准化接口，Qwen、DeepSeek、GPT 等主流模型均兼容
- 原生支持 Streaming（流式）响应，是实现打字机效果的基础
- 社区生态成熟，TypeScript 类型定义完善
- 切换模型只需修改 API 地址和模型名称，无需改动业务代码

### 3.2 模型配置

| 配置项 | 默认值 | 说明 |
|-------|--------|------|
| API 地址 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | Qwen 兼容 OpenAI 的 endpoint |
| 模型名称 | `qwen-turbo` | 可根据需求切换 |
| API Key | 用户自行配置 | 通过设置页配置 |
| 温度 | 0.3 | 翻译场景使用较低温度保证准确性 |

### 3.3 翻译请求流程

```
获取 Markdown 原文
        │
        ▼
构造 System Prompt + User Prompt
        │
        ▼
通过 OpenAI SDK 发起 Streaming 请求
        │
        ▼
逐 chunk 接收翻译结果
        │
        ▼
实时更新 Popup 中的 md-wx 组件（打字机效果）
        │
        ▼
翻译完成后，将结果存入 chrome.storage.local
```

### 3.4 Prompt 设计

**System Prompt 核心要点：**

- 将英文翻译为中文
- 保留所有 Markdown 格式标记（标题、图片、链接、代码块等）
- 不翻译代码块中的内容
- 图片的 `![alt](src)` 中的 alt 文本需要翻译，但 src 保持原样
- 链接的 `[text](url)` 中的 text 需要翻译，但 url 保持原样

### 3.5 错误处理

- 网络错误：提示用户检查网络连接
- API Key 无效：引导用户前往设置页配置
- 速率限制：提示稍后重试
- 模型不可用：提示检查模型名称配置

## 4. 目录结构规范

```
chrome-extension-en-translation/
├── public/                          # 静态资源
│   ├── icons/                       # 插件图标（16/48/128）
│   └── manifest.json                # Chrome 扩展清单
│
├── src/                             # 源码目录
│   ├── popup/                       # 插件弹窗
│   │   ├── index.html               # 弹窗 HTML 入口
│   │   ├── main.tsx                 # 弹窗 React 入口
│   │   ├── App.tsx                  # 弹窗主组件
│   │   ├── components/              # 弹窗子组件
│   │   │   ├── StatusBar.tsx        # 状态栏组件
│   │   │   ├── TranslationView.tsx  # 翻译结果展示区（集成 md-wx）
│   │   │   └── ActionButtons.tsx    # 操作按钮（复制/重新翻译/取消）
│   │   └── styles/                  # 弹窗样式
│   │       └── popup.css
│   │
│   ├── options/                     # 设置页
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── components/
│   │       └── SettingsForm.tsx     # 设置表单（API Key、地址、模型等）
│   │
│   ├── content/                     # Content Script（注入网页）
│   │   ├── content.ts               # 内容脚本入口
│   │   ├── extractor/               # 内容提取模块
│   │   │   ├── index.ts             # 提取器入口（策略选择）
│   │   │   ├── defuddle-extractor.ts    # Defuddle 提取封装
│   │   │   ├── readability-extractor.ts # Readability 提取封装
│   │   │   └── types.ts             # 提取结果类型定义
│   │   └── converter/               # Markdown 转换模块
│   │       ├── turndown.ts          # Turndown.js 配置与自定义规则
│   │       └── image-handler.ts     # 图片 URL 处理（相对路径转绝对路径）
│   │
│   ├── background/                  # Service Worker
│   │   ├── background.ts            # 后台脚本入口
│   │   ├── translator.ts            # 翻译服务（OpenAI SDK 调用）
│   │   └── storage.ts               # Chrome Storage 读写封装
│   │
│   ├── shared/                      # 共享模块
│   │   ├── types.ts                 # 全局类型定义
│   │   ├── constants.ts             # 常量定义
│   │   └── messages.ts              # 消息协议定义（popup ↔ content ↔ background）
│   │
│   └── assets/                      # 其他前端资源
│
├── docs/                            # 文档
│   ├── proposal.md                  # 需求文档
│   └── design.md                    # 技术架构文档（本文件）
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

### 4.1 目录设计原则

- **按功能模块组织**：popup、options、content、background 各自独立目录，职责清晰
- **共享逻辑抽离**：shared 目录存放跨模块共享的类型、常量和消息协议
- **提取与转换分离**：content 下分 extractor 和 converter 两个子模块，便于独立测试和替换

## 5. 模块间通信协议

### 5.1 消息流

```
Popup (React)                    Content Script              Service Worker
    │                                │                           │
    │  ── 1. 请求提取内容 ──────────►  │                           │
    │                                │                           │
    │  ◄── 2. 返回 Markdown 原文 ────  │                           │
    │                                │                           │
    │  ── 3. 请求翻译（原文） ──────────────────────────────────►  │
    │                                │                           │
    │  ◄── 4. Streaming 逐块返回 ────────────────────────────────  │
    │        （打字机效果更新）          │                           │
    │                                │                           │
    │  ── 5. 保存结果 ──────────────────────────────────────────►  │
    │                                │                           │
```

### 5.2 消息类型定义

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

## 6. 数据流设计

### 6.1 核心数据流

```
用户点击插件图标
        │
        ▼
┌──────────────────────────────────────────────────┐
│  Popup 打开，检查 chrome.storage.local 中是否有   │
│  上次翻译结果                                     │
│  ├── 有：加载上次结果，展示在 md-wx 组件中          │
│  └── 无：显示空状态                                │
└──────────────────────────────────────────────────┘
        │
        ▼
用户点击"翻译当前页面"
        │
        ▼
┌──────────────────────────────────────────────────┐
│  向 Content Script 发送 EXTRACT_CONTENT 消息      │
│                                                  │
│  Content Script 执行：                            │
│  1. 获取页面 DOM                                  │
│  2. Defuddle 提取（失败则降级 Readability）        │
│  3. Turndown.js 转为 Markdown                     │
│  4. 返回 CONTENT_RESULT 给 Popup                  │
└──────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────┐
│  Popup 显示"翻译中"状态                            │
│  向 Background 发送 TRANSLATE_STREAM 消息          │
│                                                  │
│  Background 执行：                                │
│  1. 通过 OpenAI SDK 发起 Streaming 请求           │
│  2. 逐 chunk 返回 TRANSLATE_CHUNK 给 Popup        │
│                                                  │
│  Popup 逐块更新 md-wx 组件，实现打字机效果          │
└──────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────┐
│  翻译完成 / 翻译中断 / 翻译出错                     │
│  ├── 完成：保存结果到 chrome.storage.local         │
│  ├── 中断：展示已翻译的部分                         │
│  └── 出错：展示错误提示，保留原文                    │
└──────────────────────────────────────────────────┘
```

### 6.2 存储设计

使用 `chrome.storage.local`，仅存储最近一次翻译结果，键值结构如下：

| 键名 | 值类型 | 说明 |
|------|--------|------|
| `lastTranslation` | `TranslationResult` | 最近一次完整翻译结果 |
| `lastTranslationMeta` | `TranslationMeta` | 最近一次翻译的元数据 |

**TranslationResult 结构：**

```typescript
interface TranslationResult {
  title: string;        // 文章标题
  author: string;       // 作者名
  originalUrl: string;  // 原文链接
  originalMarkdown: string;  // 原文 Markdown
  translatedMarkdown: string; // 翻译后的 Markdown
  translatedAt: number; // 翻译完成时间戳
}
```

## 7. md-wx 集成方案

### 7.1 集成方式

md-wx 作为 npm package 安装到项目中，在 Popup 的翻译结果展示区中使用。

**安装命令：**

```bash
npm install md-wx
```

**使用场景：**

- 在 `TranslationView.tsx` 组件中引入 `MarkdownRenderer` 组件
- 将翻译后的 Markdown 字符串作为 `markdown` prop 传入
- 通过打字机效果逐段更新 `markdown` prop 的值，实现动态展示

### 7.2 配置项

| 配置项 | 值 | 说明 |
|-------|-----|------|
| `markdown` | 翻译结果字符串 | 动态更新实现打字机效果 |
| `showSettings` | `false` | 隐藏主题/视图切换设置面板 |
| `enableCopy` | `true` | 允许用户复制翻译结果 |
| `enableThemeSwitch` | `false` | 禁用主题切换（统一使用默认主题） |
| `enableViewModeToggle` | `false` | 禁用视图模式切换 |
| `defaultViewMode` | `'mobile'` | 插件弹窗较小，使用移动端视图 |

### 7.3 打字机效果实现原理

打字机效果并非通过 md-wx 组件本身实现，而是通过外部状态控制：

1. Background 接收到 Streaming 翻译结果后，逐块转发给 Popup
2. Popup 维护一个递增的字符串缓冲区，将每次收到的 chunk 追加到缓冲区末尾
3. 将缓冲区的最新字符串作为 `markdown` prop 传入 `<MarkdownRenderer>`
4. React 的 diff 机制确保仅新增内容触发渲染，保持性能

## 8. 编码规范

### 8.1 语言与工具

- **语言**：TypeScript，严格模式（`strict: true`）
- **格式化**：Prettier，统一代码风格
- **代码检查**：ESLint，使用 `@typescript-eslint` 规则集

### 8.2 命名规范

| 类别 | 规范 | 示例 |
|------|------|------|
| 文件/目录 | kebab-case | `defuddle-extractor.ts` |
| 组件 | PascalCase | `TranslationView.tsx` |
| 变量/函数 | camelCase | `extractContent()` |
| 类型/接口 | PascalCase | `TranslationResult` |
| 常量 | UPPER_SNAKE_CASE | `DEFAULT_API_URL` |
| 消息类型 | UPPER_SNAKE_CASE | `EXTRACT_CONTENT` |

### 8.3 文件组织规范

- 每个文件只导出一个主要功能（默认导出）
- 每个文件不超过 200 行（超过时考虑拆分）
- 同模块的测试文件与源文件放在同一目录，命名为 `*.test.ts`
- 样式文件与组件文件放在同一目录

### 8.4 代码质量标准

- 所有函数必须有明确的参数类型和返回类型
- 禁止使用 `any` 类型，必要时使用 `unknown` 替代
- 禁止在 content script 中直接操作弹出 UI
- 所有异步操作必须有完整的错误处理（try-catch）
- Streaming 响应必须处理中断和错误场景

### 8.5 Commit 规范

使用 Conventional Commits 规范：

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 Bug |
| `refactor` | 重构 |
| `docs` | 文档更新 |
| `style` | 代码格式调整 |
| `chore` | 构建/工具链变更 |

## 9. 外部依赖清单

| 依赖 | 版本 | 用途 |
|------|------|------|
| `react` | ^18 | 弹窗 UI 框架 |
| `react-dom` | ^18 | DOM 渲染 |
| `defuddle` | latest | 文章内容提取 |
| `@mozilla/readability` | ^0.5 | 内容提取降级方案 |
| `turndown` | ^7 | HTML 转 Markdown |
| `openai` | ^4 | AI 翻译（OpenAI SDK 兼容） |
| `md-wx` | latest | Markdown 翻译结果渲染 |
| `@crxjs/vite-plugin` | ^2 | Vite 插件，构建 Chrome 扩展 |
| `vite` | ^5 | 构建工具 |
| `typescript` | ^5 | 开发语言 |
| `prettier` | ^3 | 代码格式化 |
| `eslint` | ^8 | 代码检查 |

## 10. 性能与安全考量

### 10.1 性能

- Defuddle/Readability 在 Content Script 中同步执行，不应阻塞主线程过久（预计 < 50ms）
- Turndown.js 转换在小规模 DOM 上性能可忽略
- Streaming 翻译的逐块更新使用 `requestAnimationFrame` 节流，避免 React 渲染频繁
- 插件弹窗使用 `will-change` 隔离渲染层，避免影响宿主页面

### 10.2 安全

- API Key 存储在 `chrome.storage.local` 中，不会同步到云端
- 翻译请求由 Service Worker 发起，避免 Content Script 直接暴露 API Key
- 所有用户输入（API 地址、模型名称）在设置页进行基本的 URL 格式校验
- 不注入任何外部脚本到宿主页面，仅通过 Content Script 操作 DOM