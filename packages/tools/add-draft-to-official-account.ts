import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

import { AgentToolResult } from "@earendil-works/pi-agent-core";
import generateArticleCover from "./generate-image";

/**
 * 将 Markdown 内容转换为微信公众号风格的 HTML
 */
function markdownToWechatHtml(markdown: string): string {
    let html = markdown;

    // 标题
    html = html.replace(/^### (.+)$/gm, '<h3 style="color: #8B0000; font-size: 17px; margin: 20px 0 10px 0;">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 style="color: #8B0000; font-size: 19px; margin: 25px 0 10px 0;">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 style="text-align: center; color: #8B0000; font-size: 22px; margin: 20px 0 10px 0;">$1</h1>');

    // 加粗
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // 分割线
    html = html.replace(/^---$/gm, '<hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />');

    const lines = html.split('\n');
    const result: string[] = [];
    let inTable = false;
    let tableRowCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed) {
            if (inTable) {
                result.push('</tbody></table>');
                inTable = false;
            }
            result.push('');
            continue;
        }

        if (/^<\/?[a-z]/i.test(trimmed)) {
            result.push(line);
            continue;
        }

        // 表格
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            const cells = trimmed.split('|').filter(c => c.trim());
            if (cells.every(c => /^[\s\-:]+$/.test(c.trim()))) continue;

            if (!inTable) {
                result.push('<table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 14px;">');
                result.push('<thead><tr style="background-color: #8B0000; color: white;">');
                cells.forEach(c => {
                    result.push(`<th style="padding: 10px 12px; border: 1px solid #ddd; text-align: center;">${c.trim()}</th>`);
                });
                result.push('</tr></thead><tbody>');
                inTable = true;
            } else {
                const bg = (tableRowCount % 2 === 0) ? '#fff' : '#fafafa';
                result.push(`<tr style="background: ${bg};">`);
                cells.forEach(c => {
                    result.push(`<td style="padding: 8px 12px; border: 1px solid #ddd; text-align: center;">${c.trim()}</td>`);
                });
                result.push('</tr>');
                tableRowCount++;
            }
            continue;
        }

        if (inTable) {
            result.push('</tbody></table>');
            inTable = false;
        }

        result.push(`<p style="font-size: 15px; line-height: 1.8; color: #333; letter-spacing: 0.5px; text-indent: 2em; margin: 10px 0;">${trimmed}</p>`);
    }

    if (inTable) {
        result.push('</tbody></table>');
    }

    const bodyContent = result.join('\n');

    return `<!DOCTYPE html>
 <html>
 <head>
 <meta charset="utf-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0">
 </head>
 <body>
 <section style="padding: 10px 16px;">
 ${bodyContent}
 </section>
 </body>
 </html>`;
}


async function addDraftToWechat(args: { title: string, content: string, author?: string, cover?: Buffer }): Promise<AgentToolResult<any>> {
    const { title, content, author = 'AI Assistant', cover } = args;

    console.log(`开始排版文章: "${title}"...`);

    try {
        // 转换为微信风格 HTML
        let htmlContent: string;
        if (content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html') || content.trim().startsWith('<section')) {
            htmlContent = content;
            console.log('内容已经是 HTML 格式,直接使用');
        } else {
            htmlContent = markdownToWechatHtml(content);
            console.log(`排版完成,HTML 长度: ${htmlContent.length} 字符`);
        }

        // 获取 Access Token
        const token = await getAccessToken();

        // 上传封面图片
        console.log('正在上传封面图片...');
        const pngBuffer = await generateArticleCover({title, content: htmlContent});
        const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);

        let body = Buffer.alloc(0);
        const append = (s: string) => { body = Buffer.concat([body, Buffer.from(s)]); };
        const appendBuf = (b: Buffer) => { body = Buffer.concat([body, b]); };

        append(`--${boundary}\r\n`);
        append(`Content-Disposition: form-data; name="media"; filename="cover.png"\r\n`);
        append(`Content-Type: image/png\r\n\r\n`);
        appendBuf(cover || pngBuffer.details.buffer);
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

export default addDraftToWechat;