import { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@earendil-works/pi-ai"
import { AgentToolResult } from "@earendil-works/pi-agent-core";
import dotenv from "dotenv";
dotenv.config();

const BASE_URL = process.env.BASE_URL;
const API_KEY = process.env.API_KEY;

/**
 * 生成文章封面图片的工具函数
 * 参数可以是: { title: string, content: string } | string
 * 返回: { buffer: Buffer, result: string } — PNG 图片的 Buffer 数据和结果信息
 */
async function generateArticleImage(args: any): Promise<AgentToolResult<{ buffer: Buffer, result: string }>> {
    try {
        let prompt: string;

        if (typeof args === "string") {
            // 直接传入提示词
            prompt = args;
        } else if (args?.title && (args?.content || args?.htmlContent)) {
            // 传入文章标题和内容，构建封面图提示词
            const contentText = args.content || args.htmlContent || "";
            const summary = contentText.replace(/<[^>]+>/g, "").slice(0, 200);
            prompt = `为微信公众号文章生成一张封面图。\n\n文章标题：${args.title}\n文章摘要：${summary}\n\n风格要求：简约大气，适合社交媒体分享，色彩协调，干净整洁，无文字覆盖。`;
        } else {
            throw new Error("参数错误：需要传入 prompt 字符串或 { title, content } 对象");
        }

        const buffer = await generateImageFromPrompt(prompt);

        return {
            content: [
                { type: "text", text: `✅ 图片已生成！大小: ${(buffer.length / 1024).toFixed(1)} KB` },
            ],
            details: { buffer, result: "生成成功" },
        };
    } catch (error: any) {
        console.error(`图片生成失败: ${error.message}`);
        return {
            content: [{ type: "text", text: `❌ 图片生成失败: ${error.message}` }],
            details: { buffer: Buffer.alloc(0), result: `生成失败: ${error.message}` },
        };
    }
}

/**
 * 使用 AI 模型根据文本提示生成图片，返回 PNG 图片 Buffer
 */
async function generateImageFromPrompt(prompt: string): Promise<Buffer> {
    console.log(`正在根据提示词生成图片...`);

    const response = await fetch(`${BASE_URL}/images/generations`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "qwen-image-max",
            prompt,
            n: 1,
            size: "1024x1024",
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 请求失败 (${response.status}): ${errorText}`);
    }

    const result: any = await response.json();

    // 尝试从响应中获取图片数据
    if (result.data?.[0]?.url) {
        // 如果有 URL，下载图片
        console.log(`图片已生成，正在下载...`);
        const imgResponse = await fetch(result.data[0].url);
        if (!imgResponse.ok) {
            throw new Error(`图片下载失败: ${imgResponse.status}`);
        }
        const buffer = Buffer.from(await imgResponse.arrayBuffer());
        console.log(`图片生成成功，大小: ${(buffer.length / 1024).toFixed(1)} KB`);
        return buffer;
    }

    if (result.data?.[0]?.b64_json) {
        const buffer = Buffer.from(result.data[0].b64_json, "base64");
        console.log(`图片生成成功，大小: ${(buffer.length / 1024).toFixed(1)} KB`);
        return buffer;
    }

    throw new Error("无法从 API 响应中提取图片数据");
}

export default function (pi: ExtensionAPI) {
    // Implementation for generating image based on prompt
    pi.registerTool({
        name: "generate_image",
        label: "生成图像工具",
        description: "根据文本提示生成图像",
        parameters: Type.Object({
            prompt: Type.String({ description: "图像生成提示词" }),
        }),
        async execute(toolCallId, params, signal, onUpdate, ctx) {
            // 这里可以根据参数执行相应的功能
            const { prompt } = params;
            // 调用之前定义的 generateArticleImage 函数
            return await generateArticleImage(prompt);
        },
    });
}