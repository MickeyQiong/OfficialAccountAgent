import { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@earendil-works/pi-ai"

import webSearch from "../../packages/tools/web-search";
import addDraftToWechat from "../../packages/tools/add-draft-to-official-account";
import generateArticleImage from "../../packages/tools/generate-image";

export default function (pi: ExtensionAPI) {
    // 1. 注册一个可以生成图像的模型提供商
    // pi.registerProvider("my-provider", {
    //     name: "My Provider",
    //     baseUrl: "https://api.wlai.vip/v1",
    //     apiKey: "sk-***",
    //     api: "openai-completions",
    //     models: [
    //         {
    //             id: "gpt-image-2",
    //             name: "generate image model",
    //             reasoning: false,
    //             input: ["text", "image"],
    //             cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    //             contextWindow: 128000,
    //             maxTokens: 4096
    //         }
    //     ]
    // });

    // 2. 注册一个联网搜索工具
    pi.registerTool({
        name: "web-search",
        label: "联网搜索工具",
        description: "提供联网搜索功能",
        parameters: Type.Object({
            query: Type.String({ description: "搜索查询" }),
        }),
        async execute(toolCallId, params, signal, onUpdate, ctx) {
            // 这里可以根据参数执行相应的功能
            return await webSearch(params);
        },
    });

    // 3. 注册公众号草稿工具
    pi.registerTool({
        name: 'add_draft',
        label: '发布公众号草稿',
        description: '将文章内容发布为微信公众号草稿',
        parameters: Type.Object({
            title: Type.String({ description: 'Article title' }),
            content: Type.String({ description: 'HTML formatted article content' }),
            author: Type.Optional(Type.String({ description: 'Author name' })),
            cover: Type.Optional(Type.Any({ description: '封面图片的 Buffer 数据' }))
        }),
        execute: async (toolCallId, params, signal, onUpdate, ctx) => {
            const { title, content, author, cover } = params;
            return await addDraftToWechat({ title, content, author, cover });
        }
    });

    // 4. 注册图像生成工具
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