/**
 * SideSeat Integration Extension for pi coding agent
 *
 * Traces every LLM call, tool execution, and agent decision, then streams
 * them in real-time to the SideSeat debug UI at http://localhost:5388.
 *
 * Prerequisites:
 *   1. Start SideSeat server:  npx sideseat
 *   2. Open http://localhost:5388 in your browser
 *   3. Run pi normally — traces appear automatically
 *
 * Environment variables (optional):
 *   SIDESEAT_ENDPOINT  — override server URL (default: http://127.0.0.1:5388)
 *   SIDESEAT_DISABLED  — set to "true" to disable tracing
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { init, shutdown, type SideSeat } from "@sideseat/sdk";
import { SpanStatusCode } from "@opentelemetry/api";

// ─── Global state ───────────────────────────────────────────────────────────

let client: SideSeat | null = null;
let tracer: ReturnType<SideSeat["getTracer"]> | null = null;

// Long-running spans (started in one event, ended in another)
let agentSpan: ReturnType<ReturnType<SideSeat["getTracer"]>["startSpan"]> | null = null;
let turnSpan: ReturnType<ReturnType<SideSeat["getTracer"]>["startSpan"]> | null = null;
const toolSpans = new Map<string, ReturnType<ReturnType<SideSeat["getTracer"]>["startSpan"]>>();
const toolStartTimes = new Map<string, number>();

// ─── Extension entry point ──────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // ═══════════════════════════════════════════════════════════════════════
  // Lifecycle: start / shutdown
  // ═══════════════════════════════════════════════════════════════════════

  pi.on("session_start", async () => {
    // Lazy-init the SideSeat client (connects to localhost:5388 by default)
    if (!client) {
      client = init({
        framework: "pi-coding-agent" as any,
        serviceName: "official-account-agent",
        serviceVersion: "1.0.0",
        debug: true,
      });
      tracer = client.getTracer("pi-coding-agent", "1.0.0");
    }
  });

  pi.on("session_shutdown", async () => {
    // End any dangling spans
    endAllSpans();
    // Flush pending traces before shutdown
    if (client) {
      await shutdown();
      client = null;
      tracer = null;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Agent-level span (covers the entire prompt → response lifecycle)
  // ═══════════════════════════════════════════════════════════════════════

  let agentStartTime = 0;

  pi.on("agent_start", async () => {
    if (!tracer) return;
    agentStartTime = Date.now();
    agentSpan = tracer.startSpan("agent.run", {
      attributes: { "agent.type": "pi-coding-agent" },
    });
  });

  pi.on("agent_end", async (event) => {
    if (agentSpan) {
      agentSpan.setAttribute("agent.duration_ms", Date.now() - agentStartTime);
      agentSpan.setAttribute("agent.messages_count", event.messages?.length ?? 0);
      agentSpan.setStatus({ code: SpanStatusCode.OK });
      agentSpan.end();
      agentSpan = null;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Turn-level span (one LLM response + its tool calls)
  // ═══════════════════════════════════════════════════════════════════════

  let turnStartTime = 0;

  pi.on("turn_start", async (event) => {
    if (!tracer) return;
    turnStartTime = Date.now();
    turnSpan = tracer.startSpan(`turn.${event.turnIndex}`, {
      attributes: { "turn.index": event.turnIndex },
    });
  });

  pi.on("turn_end", async (event) => {
    if (turnSpan) {
      turnSpan.setAttribute("turn.duration_ms", Date.now() - turnStartTime);
      turnSpan.setAttribute("turn.tools_called", event.toolResults?.length ?? 0);
      turnSpan.setStatus({ code: SpanStatusCode.OK });
      turnSpan.end();
      turnSpan = null;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // LLM provider request (the actual HTTP call to the model API)
  // ═══════════════════════════════════════════════════════════════════════

  let llmSpan: ReturnType<ReturnType<SideSeat["getTracer"]>["startSpan"]> | null = null;
  let llmStartTime = 0;

  pi.on("before_provider_request", (event) => {
    if (!tracer) return;
    llmStartTime = Date.now();
    llmSpan = tracer.startSpan("llm.request", {});
  });

  pi.on("after_provider_response", (event) => {
    if (!llmSpan) return;
    llmSpan.setAttribute("llm.status_code", event.status);
    llmSpan.setAttribute("llm.duration_ms", Date.now() - llmStartTime);
    if (event.status >= 400) {
      llmSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: `HTTP ${event.status}`,
      });
    } else {
      llmSpan.setStatus({ code: SpanStatusCode.OK });
    }
    llmSpan.end();
    llmSpan = null;
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Tool execution spans
  // ═══════════════════════════════════════════════════════════════════════

  pi.on("tool_execution_start", (event) => {
    if (!tracer) return;
    toolStartTimes.set(event.toolCallId, Date.now());
    const span = tracer.startSpan(`tool.${event.toolName}`, {
      attributes: {
        "tool.name": event.toolName,
        "tool.call_id": event.toolCallId,
      },
    });
    toolSpans.set(event.toolCallId, span);
  });

  pi.on("tool_execution_end", (event) => {
    const span = toolSpans.get(event.toolCallId);
    if (!span) return;

    const startTime = toolStartTimes.get(event.toolCallId) ?? 0;
    span.setAttribute("tool.duration_ms", Date.now() - startTime);

    if (event.isError) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: String(event.result ?? "unknown error"),
      });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    span.end();
    toolSpans.delete(event.toolCallId);
    toolStartTimes.delete(event.toolCallId);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Message end — capture token usage and cost
  // ═══════════════════════════════════════════════════════════════════════

  pi.on("message_end", (event) => {
    if (!llmSpan || event.message.role !== "assistant") return;

    const usage = event.message.usage;
    if (usage) {
      llmSpan.setAttribute("llm.token_count.prompt", usage.input ?? 0);
      llmSpan.setAttribute("llm.token_count.completion", usage.output ?? 0);
      if (usage?.cost?.total !== undefined) {
        llmSpan.setAttribute("llm.cost.total", usage.cost.total);
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Tool call interception — enrich with input parameters
  // ═══════════════════════════════════════════════════════════════════════

  pi.on("tool_call", (event) => {
    const span = toolSpans.get(event.toolCallId);
    if (span && event.input) {
      // Record tool input (truncated to avoid huge span attributes)
      const inputStr = JSON.stringify(event.input);
      span.setAttribute(
        "tool.input",
        inputStr.length > 1000 ? inputStr.slice(0, 1000) + "..." : inputStr,
      );
    }
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function endAllSpans() {
  if (agentSpan) {
    agentSpan.setStatus({ code: SpanStatusCode.ERROR, message: "session shutdown" });
    agentSpan.end();
    agentSpan = null;
  }
  if (turnSpan) {
    turnSpan.setStatus({ code: SpanStatusCode.ERROR, message: "session shutdown" });
    turnSpan.end();
    turnSpan = null;
  }
  for (const [id, span] of toolSpans) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: "session shutdown" });
    span.end();
  }
  toolSpans.clear();
  toolStartTimes.clear();
}
