import { getImageModel, generateImages } from "@earendil-works/pi-ai";
import { AgentToolResult } from "@earendil-works/pi-agent-core";

/**
 * 根据文章标题和内容构建图片生成提示词
 */
function buildImagePrompt(title: string, content: string): string {
  // 取文章前 200 字作为内容摘要，避免过长
  const summary = content.replace(/<[^>]+>/g, "").slice(0, 200);
  return `为微信公众号文章生成一张封面图。

文章标题：${title}
文章摘要：${summary}

风格要求：简约大气，适合社交媒体分享，色彩协调，干净整洁，无文字覆盖。`;
}

/**
 * 使用 AI 模型根据文章生成封面图片，返回 PNG 图片 Buffer
 */
async function generateArticleCover(title: string, content: string): Promise<Buffer> {
  const prompt = buildImagePrompt(title, content);

  console.log(`正在为文章 "${title}" 生成封面图片...`);

  // 获取图片生成模型 (使用注册的自定义 provider)
  const model = getImageModel("my-provider", "gpt-image-2");
  if (!model) throw new Error("Image model not found");

  const result = await generateImages(model, {
    input: [{ type: "text", text: prompt }],
  });

  // 从输出中提取图片数据
  const imageContent = result.output.find((o) => o.type === "image");
  if (!imageContent || !("data" in imageContent)) {
    throw new Error("No image generated");
  }

  const buffer = Buffer.from(imageContent.data, "base64");
  console.log(`封面图片生成成功，大小: ${(buffer.length / 1024).toFixed(1)} KB`);

  return buffer;
}

/**
 * 生成文章封面图片的工具函数
 * 参数: { title: string, content: string }
 * 返回: { buffer: Buffer } — PNG 图片的 Buffer 数据
 */
export default async function generateArticleImage(args: any): Promise<AgentToolResult<{ buffer: Buffer }>> {
  const { title, content } = args;

  try {
    const buffer = await generateArticleCover(title, content);

    return {
      content: [
        { type: "text", text: `✅ 封面图片已生成！大小: ${(buffer.length / 1024).toFixed(1)} KB` },
      ],
      details: { buffer },
    };
  } catch (error: any) {
    console.error(`封面图片生成失败: ${error.message}`);
    return {
      content: [{ type: "text", text: `❌ 封面图片生成失败: ${error.message}` }],
      details: { result: `生成失败: ${error.message}` },
    };
  }
}
