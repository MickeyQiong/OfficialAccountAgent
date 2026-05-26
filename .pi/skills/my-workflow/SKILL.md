---
name: wechat-publish-workflow
description: 微信公众号文章发布完整工作流。按序执行：生成封面图 → Markdown转HTML → 发布草稿。当用户需要将文章发布为公众号草稿时使用此技能。
---

# 微信公众号文章发布工作流

一键完成"封面生成 → 排版转换 → 草稿发布"的完整流水线。

## 工作流程

```
generate-image → markdown-to-html → add_draft
     ↓                ↓                ↓
  封面图片         HTML排版         公众号草稿
```

## 使用方式

### 方式一：直接使用内置工具（推荐）

按照以下**固定顺序**依次调用工具：

#### 第 1 步：生成封面图

使用 `generate_image` 工具，根据文章主题生成封面：

```
generate_image(prompt: "根据文章主题描述的封面图提示词")
```

#### 第 2 步：转换 HTML 排版

使用 `markdown_to_html` 工具，将 Markdown 文章转为微信公众号兼容的 HTML：

```
markdown_to_html(markdown: "完整的 Markdown 文章内容")
```

#### 第 3 步：发布草稿

**关键：** 由于 `add_draft` 需要封面的 Buffer 数据，且 Buffer 无法在工具间直接传递，请使用项目中的辅助脚本 `publish_draft.js` 来完成最后一步。该脚本会：

1. 自动生成封面图
2. 上传封面至微信素材库
3. 将 HTML 内容发布为公众号草稿

```bash
cd /Users/mingqiang/VSCodeProjects/OfficialAccountAgent && node publish_draft.js
```

**注意：** 在执行 `publish_draft.js` 前，确保脚本中的 `HTML_CONTENT` 已替换为第 2 步生成的 HTML。

### 方式二：使用辅助脚本一键完成

项目中的 `publish_draft.js` 脚本封装了完整流水线。使用前，将 Markdown 文章先通过 `markdown_to_html` 转换为 HTML，然后更新脚本中的 `HTML_CONTENT` 变量并运行：

```bash
node /Users/mingqiang/VSCodeProjects/OfficialAccountAgent/publish_draft.js
```

## 完整示例

假设要发布一篇关于"啤酒酿造"的文章：

1. **生成封面**：`generate_image(prompt: "啤酒酿造工艺，金黄麦芽、啤酒花...")`
2. **转换排版**：`markdown_to_html(markdown: "# 啤酒酿造...")`
3. **发布草稿**：将第 2 步的 HTML 写入 `publish_draft.js` 的 `HTML_CONTENT`，执行 `node publish_draft.js`

## 前置条件

- `.env` 文件中已配置 `WECHAT_APP_ID`、`WECHAT_APP_SECRET`、`BASE_URL`、`API_KEY`
- Node.js 环境已安装依赖
- 微信 IP 白名单已配置

## 相关文件

- `publish_draft.js` — 完整流水线脚本（封面上传 + 草稿发布）
- `.pi/extensions/generate-image.ts` — 封面生成扩展
- `.pi/extensions/markdown-to-html.ts` — Markdown 转 HTML 扩展
- `.pi/extensions/wechat-assistant.ts` — 微信公众号草稿扩展
