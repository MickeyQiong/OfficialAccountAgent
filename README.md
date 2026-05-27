# Official Account Agent

基于 [pi coding agent](https://github.com/earendil-works/pi-coding-agent) 构建的**微信公众号文章自动化发布助手**。通过 AI 驱动的工作流，一键完成封面生成 → 排版转换 → 草稿发布的全流程。

## 工作流

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  generate_image │ ───→ │  markdown_to_html│ ───→ │   add_draft     │
│   生成封面图片    │      │  Markdown → HTML │      │  发布公众号草稿    │
└─────────────────┘      └──────────────────┘      └─────────────────┘
```

只需提供文章标题和 Markdown 内容，AI 自动完成：

1. **封面生成** — 根据文章主题 AI 生成封面图，自动上传微信素材库
2. **排版转换** — Markdown 转为微信公众号兼容的 HTML（标题着色、表格样式等）
3. **草稿发布** — 推送到公众号草稿箱，在后台预览后即可群发

## 项目结构

```
OfficialAccountAgent/
├── .pi/
│   ├── extensions/           # pi 扩展（自定义工具）
│   │   ├── generate-image.ts  # AI 生成封面图 + 微信素材上传
│   │   ├── markdown-to-html.ts # Markdown → 公众号 HTML 排版
│   │   ├── add-draft.ts       # 公众号草稿发布 + Access Token 管理
│   │   └── web-search.ts      # 联网搜索（预留）
│   └── skills/
│       └── my-workflow/
│           └── SKILL.md      # 发布工作流技能定义
├── articles/                 # Markdown 文章存档
│   ├── 200-300-baijiu-guide.md
│   └── beer_brewing_article.md
├── material/                 # 素材文件（封面图片等）
├── .env                      # 环境变量配置（不入库）
├── package.json
└── README.md
```

## 快速开始

### 前置条件

1. **Node.js** 环境（推荐 v18+）
2. **微信公众号**（服务号或订阅号），并在后台配置 IP 白名单
3. **AI 图像生成 API**（如通义万象等 OpenAI 兼容接口）

### 安装

```bash
npm install
```

### 配置

在项目根目录创建 `.env` 文件：

```env
# 微信公众号配置
WECHAT_APP_ID=your_app_id
WECHAT_APP_SECRET=your_app_secret

# AI 图像生成 API 配置
BASE_URL=https://your-api-endpoint
API_KEY=your_api_key
```

### IP 白名单

登录 [微信公众平台](https://mp.weixin.qq.com) → 设置与开发 → 安全中心 → IP 白名单，添加服务器 IP。

## 使用方式

在 pi 对话中直接描述需求即可：

```
发布一篇文章，标题是"中国啤酒的分类"
```

AI 会自动撰写文章并按工作流执行发布。也可以直接提供 Markdown 内容：

```markdown
# 文章标题

文章正文...
```

## 扩展说明

### generate-image

根据文本提示生成封面图并上传至微信素材库。

- 参数：`prompt`（图像描述提示词）
- 返回：`mediaId`（用于后续发布）

### markdown-to-html

将 Markdown 转换为微信公众号兼容的 HTML 格式，自动应用标题颜色（`#8B0000`）、表格样式等。

- 支持：标题 #/##/###、加粗、分割线、表格
- 参数：`markdown`（完整 Markdown 文本）
- 返回：格式化 HTML 字符串

### add-draft

将 HTML 文章发布为微信公众号草稿。

- 参数：`title`、`content`/`htmlContent`、`author`（默认"米奇"）、`mediaId`
- 成功后在公众号后台 → 素材管理中预览和群发

## 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| `40164 IP不在白名单` | 微信 API 拒绝未授权 IP | 添加当前服务器 IP 到白名单 |
| `WECHAT_APP_ID 未设置` | `.env` 未配置 | 检查 `.env` 文件并确保变量名正确 |
| `图片生成失败` | API 配置无效 | 检查 `BASE_URL` / `API_KEY` 是否正确 |
| `invalid media_id` | 封面 mediaId 未正确传递 | 确保 `htmlContent` + `mediaId` 同时传入 |

## 技术栈

- **[pi coding agent](https://github.com/earendil-works/pi-coding-agent)** — AI 编程代理框架
- **@earendil-works/pi-ai** — 类型化工具参数定义
- **dotenv** — 环境变量管理
- **微信公众平台 API** — 素材上传 / 草稿发布
