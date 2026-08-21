# 项目规则

> 适用于 Chrome 翻译插件（chrome-extension-en-translation）的 AI 开发规则。

---

## 1. 项目概述

Chrome 浏览器翻译插件，能够从英文网页中提取主要文章内容，转换为 Markdown 格式，调用 AI 大模型进行翻译，并以打字机效果动态展示。

---

## 2. 技术栈

| 层次 | 技术方案 |
|------|---------|
| 扩展框架 | Chrome Manifest V3 |
| 前端框架 | React 18 |
| 构建工具 | Vite + @crxjs/vite-plugin |
| 内容提取 | Defuddle（主）+ Mozilla Readability（备） |
| HTML 转 Markdown | Turndown.js |
| AI 翻译 | OpenAI SDK 兼容接口（Qwen 模型） |
| 翻译结果展示 | md-wx（npm package） |
| 本地持久化 | Chrome Storage API |
| 包管理 | npm |
| 语言 | TypeScript（严格模式） |

---

## 3. 目录结构

```
chrome-extension-en-translation/
├── public/                      
│   ├── icons/                   
│   └── manifest.json            
├── src/                         
│   ├── popup/                   
│   │   ├── index.html           
│   │   ├── main.tsx             
│   │   ├── App.tsx              
│   │   ├── components/          
│   │   └── styles/              
│   ├── options/                 
│   │   ├── index.html           
│   │   ├── main.tsx             
│   │   └── components/          
│   ├── content/                 
│   │   ├── content.ts           
│   │   ├── extractor/           
│   │   └── converter/           
│   ├── background/              
│   │   ├── background.ts        
│   │   ├── translator.ts        
│   │   └── storage.ts           
│   ├── shared/                  
│   │   ├── types.ts             
│   │   ├── constants.ts         
│   │   └── messages.ts          
│   └── assets/                  
├── docs/                        
│   ├── proposal.md              
│   ├── design.md                
│   ├── task.md                  
│   └── Schematic diagram/       
├── .trae/                       
│   └── rules/                   
│       └── project_rules.md     
├── package.json                 
├── tsconfig.json                
├── vite.config.ts               
└── README.md                    
```

**目录设计原则：**
- 按 Chrome 扩展模块组织目录（popup / options / content / background）
- 跨模块共享的逻辑放入 shared 目录
- 内容提取与 Markdown 转换分离为 extractor 和 converter 两个子模块

---

## 4. 代码规范

### 4.1 语言与工具

- 使用 TypeScript，开启严格模式（`strict: true`）
- 使用 Prettier 统一代码格式
- 使用 ESLint + `@typescript-eslint` 规则集进行代码检查
- 禁止使用 `any` 类型，必要时使用 `unknown` 替代

### 4.2 命名规范

| 类别 | 规范 | 示例 |
|------|------|------|
| 文件/目录 | kebab-case | `defuddle-extractor.ts` |
| React 组件 | PascalCase | `TranslationView.tsx` |
| 变量/函数 | camelCase | `extractContent()` |
| 类型/接口 | PascalCase | `TranslationResult` |
| 常量 | UPPER_SNAKE_CASE | `DEFAULT_API_URL` |
| 消息类型 | UPPER_SNAKE_CASE | `EXTRACT_CONTENT` |

### 4.3 代码质量要求

- 每个文件只导出一个主要功能（默认导出）
- 每个文件不超过 200 行，超过时考虑拆分
- 所有函数必须有明确的参数类型和返回类型
- 所有异步操作必须有完整的错误处理（try-catch）
- Streaming 响应必须处理中断和错误场景
- 禁止在 content script 中直接操作 Popup UI

---

## 5. 依赖管理规范

- 使用 npm 管理依赖，锁定版本（package-lock.json 提交到仓库）
- 安装依赖时指定确切版本或宽松版本（如 `^4`）
- 仅在需要时安装依赖，避免冗余包
- 开发依赖与生产依赖分开声明（devDependencies vs dependencies）

---

## 6. 模块通信规范

- Popup、Content Script、Service Worker 之间通过 Chrome 消息 API 通信
- 消息类型在 `src/shared/messages.ts` 中统一定义
- 所有消息使用 TypeScript 类型约束载荷结构
- 消息流方向：Popup → Content（提取）、Popup → Background（翻译/存储）

---

## 7. 项目文档规范

- 需求文档：`docs/proposal.md`
- 技术架构文档：`docs/design.md`
- 任务拆分文档：`docs/task.md`
- 页面布局示意图：`docs/Schematic diagram/`
- 修改文档时需同步更新相关引用

---

## 8. AI 助手任务执行规范

### 8.1 任务范围控制

- **严格按照任务拆分执行**：必须严格按照 `docs/task.md` 中定义的任务范围执行，不得超出指定任务的边界
- **单一任务原则**：每次只执行一个明确指定的任务（如"任务 1"、"任务 2"等），完成后等待用户确认再进行下一步
- **禁止自动扩展**：不得基于技术架构文档或其他文档自行扩展任务范围，如果需要扩展需通知用户确认

### 8.2 任务指令格式

用户应使用以下格式明确指定任务：
- **明确任务编号**："请执行任务 X：[任务名称]"
- **范围限制**："只完成任务 X 中列出的具体任务，不要超出范围"
- **停止指令**："完成后等待我确认再进行下一步"

### 8.3 执行验收标准

- **任务完成确认**：每个任务完成后，必须对照 `docs/task.md` 中的验收标准进行自检
- **范围边界检查**：确保所有创建的文件和代码都在指定任务范围内
- **等待用户确认**：任务完成后总结完成情况，等待用户确认后再进行下一个任务

### 8.4 异常处理

- **任务描述不清晰**：如果任务描述不清晰，应先询问具体范围而不是自行决定
- **依赖关系处理**：如果当前任务依赖其他未完成的任务，应明确指出依赖关系并等待用户指示
- **超出范围的代码**：如果发现已创建超出任务范围的代码，应主动询问是否需要清理

---

## 9. 安全规范

- API Key 存储在 `chrome.storage.local` 中，不硬编码在源码中
- 翻译请求由 Service Worker 发起，避免 Content Script 直接暴露 API Key
- 不注入任何外部脚本到宿主页面，仅通过 Content Script 操作 DOM
- 所有用户输入（API 地址、模型名称）在设置页进行基本的 URL 格式校验