import { AgentToolResult } from "@earendil-works/pi-agent-core";

async function webSearch(params:any): Promise<AgentToolResult<any>> {
    return {
        content: [{ type: "text", text: "这是一个模拟的搜索结果，实际应用中应该调用搜索引擎API获取真实数据。" }],
        details: { result: "..." },
    };
}

export default webSearch;