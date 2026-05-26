import { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@earendil-works/pi-ai"
import { AgentToolResult } from "@earendil-works/pi-agent-core";
import dotenv from "dotenv";
dotenv.config();

const ADD_DRAFT_TOOL_PARAMS = Type.Object({
    title: Type.String({ description: 'Article title' }),
    content: Type.String({ description: 'HTML formatted article content' }),
    author: Type.Optional(Type.String({ description: 'Author name' })),
    coverImage: Type.Optional(Type.Any({ description: '封面图片的 Buffer 数据' })),
    htmlContent: Type.Optional(Type.String({ description: '如果 content 已经是 HTML 格式，可以直接传入' })),
});

// 获取微信Access Token的工具函数
async function getAccessToken(): Promise<string> {
    const appId = process.env.WECHAT_APP_ID;
    const appSecret = process.env.WECHAT_APP_SECRET;

    if (!appId || !appSecret) {
        throw new Error("环境变量 WECHAT_APP_ID 或 WECHAT_APP_SECRET 未设置。请确保 .env 文件已配置。");
    }

    console.log('正在获取微信 Access Token...');
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
    const response = await fetch(url);
    const data: any = await response.json();

    if (data.errcode) {
        if (data.errcode === 40164) {
            const ipMatch = data.errmsg.match(/(\d+\.\d+\.\d+\.\d+)/);
            const ip = ipMatch ? ipMatch[0] : '未知';
            throw new Error(`40164 IP ${ip} 不在白名单中。请登录公众号后台添加该IP。`);
        }
        throw new Error(`获取 Access Token 失败: ${data.errmsg}`);
    }

    console.log('Access Token 获取成功');
    return data.access_token;
}

// 将文章内容发布为微信公众号草稿的工具函数
async function addDraftToWechat(args: any): Promise<AgentToolResult<any>> {
    const { title, content, author = 'AI Assistant', coverImage, htmlContent } = args;

    console.log(`开始排版文章: "${title}"...`);

    try {
        // 获取 Access Token
        const token = await getAccessToken();

        // 上传封面图片
        console.log('正在上传封面图片...');
        // const pngBuffer = await generateArticleCover({title, content: htmlContent});
        const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);

        let body = Buffer.alloc(0);
        const append = (s: string) => { body = Buffer.concat([body, Buffer.from(s)]); };
        const appendBuf = (b: Buffer) => { body = Buffer.concat([body, b]); };

        append(`--${boundary}\r\n`);
        append(`Content-Disposition: form-data; name="media"; filename="cover.png"\r\n`);
        append(`Content-Type: image/png\r\n\r\n`);
        appendBuf(coverImage);
        append(`\r\n--${boundary}--\r\n`);

        const uploadResp = await fetch(
            `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${token}&type=thumb`,
            {
                method: 'POST',
                headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
                body: body,
            }
        );
        const uploadResult: any = await uploadResp.json();

        if (uploadResult.errcode) {
            throw new Error(`上传封面失败: ${uploadResult.errmsg}`);
        }

        const thumbMediaId = uploadResult.media_id;
        console.log(`封面上传成功`);

        // 发布草稿
        console.log('正在发布草稿到微信公众号...');
        const draftData = {
            articles: [{
                title: title,
                author: author,
                content: htmlContent,
                thumb_media_id: thumbMediaId,
                need_open_comment: 1,
                only_fans_can_comment: 0
            }]
        };

        const wechatApiUrl = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${token}`;
        const response = await fetch(wechatApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(draftData),
        });

        const result: any = await response.json();
        if (result.errcode && result.errcode !== 0) {
            throw new Error(`微信API错误 ${result.errcode}: ${result.errmsg}`);
        }

        console.log(`草稿发布成功!媒体ID: ${result.media_id}`);
        return {
            content: [{ type: "text", text: `✅ 草稿发布成功!\n\n标题:${title}\n作者:${author}\n\n可在公众号后台 → 素材管理 中查看并发布。` }],
            details: { result: `草稿发布成功!媒体ID: ${result.media_id}` },
        };

    } catch (error: any) {
        console.error(`发布失败: ${error.message}`);
        let errorMsg = `❌ 发布失败: ${error.message}`;

        if (error.message.includes('40164')) {
            const ipMatch = error.message.match(/(\d+\.\d+\.\d+\.\d+)/);
            const ip = ipMatch ? ipMatch[0] : '当前服务器';
            errorMsg += `\n\n请登录微信公众平台 → 设置与开发 → 安全中心 → IP白名单,将 IP ${ip} 加入白名单。`;
        }

        return {
            content: [{ type: "text", text: errorMsg }],
            details: { result: `发布失败: ${error.message}` },
        };
    }
}

export default function (pi: ExtensionAPI) {
    // 注册公众号草稿工具
    pi.registerTool({
        name: 'add_draft',
        label: '发布公众号草稿',
        description: '将文章内容发布为微信公众号草稿',
        parameters: ADD_DRAFT_TOOL_PARAMS,
        execute: async (toolCallId, params, signal, onUpdate, ctx) => {
            return await addDraftToWechat(params);
        }
    });
}