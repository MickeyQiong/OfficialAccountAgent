import { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@earendil-works/pi-ai"
import { AgentToolResult } from "@earendil-works/pi-agent-core";

/**
 * 将 Markdown 内容转换为微信公众号风格的 HTML
 */
function markdownToWechatHtml(markdown: string): AgentToolResult<string> {
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

    const htmlContent = `<!DOCTYPE html>
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
    console.log(`排版完成,HTML 长度: ${htmlContent.length} 字符`);
    return {
        content: [{ type: "text", text: htmlContent }],
        details: htmlContent,
    };
}

export default function (pi: ExtensionAPI) {
    // 注册 Markdown 转 HTML 工具
    pi.registerTool({
        name: 'markdown_to_html',
        label: 'Markdown 转 HTML',
        description: '将 Markdown 格式的文本转换为适合微信公众号的 HTML 格式',
        parameters: Type.Object({
            markdown: Type.String({ description: 'Markdown 格式的文本' })
        }),
        execute: async (toolCallId, params, signal, onUpdate, ctx) => {
            const markdown = params.markdown;
            return markdownToWechatHtml(markdown);
        }
    });
}