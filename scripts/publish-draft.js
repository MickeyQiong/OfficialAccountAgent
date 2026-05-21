#!/usr/bin/env node
/**
 * 微信公众号草稿发布脚本
 * 
 * 使用方法：
 *   node scripts/publish-draft.js
 */

const fs = require('fs');
const path = require('path');

// 加载 .env
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    const envText = fs.readFileSync(envPath, 'utf-8');
    envText.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            process.env[match[1].trim()] = match[2].trim();
        }
    });
}

// 生成微信风格的 HTML
function generateWechatHTML(markdown) {
    let html = markdown;

    // 标题
    html = html.replace(/^### (.+)$/gm, '<h3 style="color: #8B0000; font-size: 17px; margin: 20px 0 10px 0;">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 style="color: #8B0000; font-size: 19px; margin: 25px 0 10px 0;">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 style="text-align: center; color: #8B0000; font-size: 22px; margin: 20px 0 10px 0;">$1</h1>');

    // 加粗 & 斜体
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // 分割线
    html = html.replace(/^---$/gm, '<hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />');

    // 链接
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color: #1a73e8; text-decoration: none;">$1</a>');

    const lines = html.split('\n');
    const result = [];
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

        // 跳过已有 HTML
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
                const bgColor = (tableRowCount % 2 === 0) ? '#fff' : '#fafafa';
                result.push(`<tr style="background: ${bgColor};">`);
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

// 生成一个简单的 SVG 封面图片（纯色背景+文字），作为封面图上传
function generateCoverImage() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="500" viewBox="0 0 900 500">
  <rect width="900" height="500" fill="#8B0000"/>
  <text x="450" y="220" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="white" text-anchor="middle">白酒选购指南</text>
  <text x="450" y="290" font-family="Arial, sans-serif" font-size="24" fill="#FFD700" text-anchor="middle">200-300元价位推荐</text>
</svg>`;
}

async function main() {
    const WECHAT_APP_ID = process.env.WECHAT_APP_ID;
    const WECHAT_APP_SECRET = process.env.WECHAT_APP_SECRET;

    if (!WECHAT_APP_ID || !WECHAT_APP_SECRET) {
        console.error('❌ 请在 .env 文件中配置 WECHAT_APP_ID 和 WECHAT_APP_SECRET');
        process.exit(1);
    }

    // 读取文章内容
    const articlePath = path.resolve(__dirname, '..', 'articles', '200-300-baijiu-guide.md');
    if (!fs.existsSync(articlePath)) {
        console.error('❌ 找不到文章文件:', articlePath);
        process.exit(1);
    }

    const markdown = fs.readFileSync(articlePath, 'utf-8');

    // 提取标题
    const titleMatch = markdown.match(/^# (.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : '200-300元价位白酒选购指南';

    console.log(`📄 文章标题: ${title}`);
    console.log('🔄 正在排版...');
    const htmlContent = generateWechatHTML(markdown);
    console.log(`✅ 排版完成，HTML 长度: ${htmlContent.length} 字符`);

    // 获取 Access Token
    console.log('🔄 正在获取 Access Token...');
    const tokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${WECHAT_APP_ID}&secret=${WECHAT_APP_SECRET}`;
    const tokenResp = await fetch(tokenUrl);
    const tokenData = await tokenResp.json();

    if (tokenData.errcode) {
        if (tokenData.errcode === 40164) {
            const ipMatch = tokenData.errmsg.match(/(\d+\.\d+\.\d+\.\d+)/);
            const ip = ipMatch ? ipMatch[0] : '未知';
            console.error(`\n❌ IP 地址 ${ip} 不在微信白名单中！请登录公众号后台添加。`);
        } else {
            console.error('❌ 获取 Access Token 失败:', tokenData.errmsg);
        }
        process.exit(1);
    }

    const token = tokenData.access_token;
    console.log('✅ Access Token 获取成功');

    // 上传封面图片
    console.log('🔄 正在上传封面图片...');
    const coverSvg = generateCoverImage();
    const coverPath = '/tmp/cover-image.svg';
    fs.writeFileSync(coverPath, coverSvg);

    // 使用 form-data 上传图片
    const { Blob } = require('buffer');
    const imageData = fs.readFileSync(coverPath);
    
    // 构建 multipart/form-data 请求
    const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
    let body = '';
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="media"; filename="cover.svg"\r\n`;
    body += `Content-Type: image/svg+xml\r\n\r\n`;
    body += coverSvg;
    body += `\r\n--${boundary}--\r\n`;

    const uploadResp = await fetch(
        `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${token}&type=thumb`,
        {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
            },
            body: body,
        }
    );
    const uploadResult = await uploadResp.json();
    
    if (uploadResult.errcode) {
        console.error('❌ 上传封面失败:', JSON.stringify(uploadResult));
        process.exit(1);
    }
    
    const thumbMediaId = uploadResult.media_id;
    console.log(`✅ 封面上传成功，media_id: ${thumbMediaId}`);

    // 发布草稿
    console.log('🔄 正在发布草稿...');
    const draftData = {
        articles: [{
            title: title,
            author: '米奇',
            content: htmlContent,
            thumb_media_id: thumbMediaId,
            need_open_comment: 1,
            only_fans_can_comment: 0
        }]
    };

    const draftUrl = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${token}`;
    const draftResp = await fetch(draftUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftData)
    });
    const draftResult = await draftResp.json();

    if (draftResult.errcode) {
        console.error('❌ 发布草稿失败:', JSON.stringify(draftResult, null, 2));
        process.exit(1);
    }

    console.log(`
✅ 草稿发布成功！
   标题: ${title}
   作者: 米奇
   媒体ID: ${draftResult.media_id}
   
   可在公众号后台素材管理中查看并发布。
    `);
}

main().catch(console.error);
