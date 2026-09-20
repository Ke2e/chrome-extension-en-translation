# 网页翻译助手

Chrome 浏览器翻译插件（Manifest V3）：一键提取英文网页正文，调用 AI 大模型翻译为中文，以打字机效果在侧边栏流式呈现排版精美的 Markdown 结果。

项目采用 SDD（Spec-Driven Development）工作流开发，需求、架构与任务拆解文档见 [docs](#sdd-文档)。

<!-- 项目预览：补充翻译效果截图（侧边栏打字机渲染）时，将图片放入 docs/screenshots/ 并取消下方注释
## 项目预览

| 侧边栏翻译效果 |
| --- |
| ![侧边栏翻译效果](docs/screenshots/sidepanel.png) |
-->

## 功能特性

- **双引擎正文提取**：优先使用 Defuddle（Obsidian 作者开发的网页剪藏提取库），提取结果经过「文章性」启发式校验（正文长度、段落结构、链接文本占比），不达标时自动降级为 Mozilla Readability（Firefox 阅读模式同款），两者均失败时明确提示页面不支持提取
- **Markdown 转换**：Turndown.js 将正文转为 Markdown，保留标题层级、列表、引用、链接与图片，相对路径图片自动拼接为绝对 URL
- **AI 流式翻译**：OpenAI SDK 兼容接口（默认对接 Qwen），Streaming 响应逐段渲染，模拟打字机效果；翻译时保留 Markdown 格式标记不翻译
- **Side Panel 侧边栏**：常驻侧边栏展示翻译结果，支持滚动阅读、一键复制、重新翻译
- **结果持久化**：最近一次翻译结果存入 `chrome.storage.local`，重开侧边栏不丢失
- **隐私安全**：API Key 仅存于本地 `chrome.storage`，不硬编码、不外传；翻译请求由 Service Worker 统一代理，Content Script 不接触密钥

## 技术栈

| 层次 | 方案 |
| --- | --- |
| 扩展框架 | Chrome Manifest V3 |
| 前端框架 | React 18 + TypeScript（strict） |
| 构建工具 | Vite + @crxjs/vite-plugin |
| 内容提取 | Defuddle（主）+ Mozilla Readability（备） |
| 格式转换 | Turndown.js |
| 翻译展示 | OpenAI SDK（流式）+ md-wx（Markdown 渲染） |
| 持久化 | Chrome Storage API |

## 架构

```
┌──────────────────────────────────────────────┐
│         Side Panel（React + md-wx 渲染）       │
├──────────────────────────────────────────────┤
│  业务逻辑层：内容提取 / AI 翻译 / 结果持久化      │
├──────────────────────────────────────────────┤
│  Content Script：Defuddle + Readability       │
│                 + Turndown.js（提取与转换）     │
├──────────────────────────────────────────────┤
│  Service Worker：API 请求代理、Storage 管理     │
├──────────────────────────────────────────────┤
│           Chrome Extensions API               │
└──────────────────────────────────────────────┘
```

模块间通过 Chrome 消息 API 通信，消息类型与载荷在 `src/shared/messages.ts` 中以 TypeScript 统一约束；提取（extractor）与转换（converter）拆分为独立子模块。

## 快速开始

```bash
npm install
npm run build     # 产物输出至 dist/
```

在 Chrome 中加载：

1. 打开 `chrome://extensions`，开启右上角「开发者模式」
2. 点击「加载已解压的扩展程序」，选择本项目的 `dist/` 目录
3. 在工具栏点击插件图标打开侧边栏

首次使用需在设置页（扩展详情 → 扩展程序选项）配置：

- **API 地址**：默认 `https://dashscope.aliyuncs.com/compatible-mode/v1`（Qwen 兼容 OpenAI 格式）
- **API Key**：从模型服务商控制台获取，仅保存在浏览器本地
- **模型名称**：如 `qwen-plus`，任意 OpenAI 兼容模型均可

## 开发

```bash
npm run dev       # 启动 Vite 开发服务器（HMR 热更新）
npm run lint      # ESLint 检查
npm run format    # Prettier 格式化
```

## SDD 文档

- [需求文档](./docs/proposal.md)：项目背景、功能需求（F-01 ~ F-15）与优先级
- [技术架构文档](./docs/design.md)：技术选型对比、双引擎提取方案、翻译架构与模块设计
- [任务拆解文档](./docs/task.md)：按任务边界拆分的开发计划与验收标准
- [页面示意图](./docs/Schematic%20diagram/)：弹窗与设置页布局设计
