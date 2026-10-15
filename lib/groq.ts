import type { Content, GenerateContentResponse } from "@google/genai";
import { functionDeclarations } from "@/lib/concierge";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * gpt-oss sometimes emits several alternative replies back to back with no space after the
 * punctuation ("...session?I'm ready..."). A real reply never does that, so keep only the first.
 */
export function keepFirstReply(text: string) {
  return text.split(/(?<=[.?!])(?=[A-Z“"])/)[0].trim();
}

/** Adapts the concierge conversation and tools to Groq's OpenAI-compatible API. */
export async function generateWithGroq(
  apiKey: string,
  model: string,
  systemInstruction: string,
  contents: Content[],
): Promise<GenerateContentResponse> {
  const messages: Record<string, unknown>[] = [{ role: "system", content: systemInstruction }];
  for (const content of contents) {
    const role = content.role === "model" ? "assistant" : "user";
    const text = content.parts?.flatMap((part) => part.text ? [part.text] : []).join("\n");
    const calls = content.parts?.flatMap((part) => part.functionCall ? [part.functionCall] : []) ?? [];
    const responses = content.parts?.flatMap((part) => part.functionResponse ? [part.functionResponse] : []) ?? [];
    if (calls.length) {
      messages.push({
        role: "assistant",
        content: text || null,
        tool_calls: calls.map((call, index) => ({
          id: call.id || `call_${index}`,
          type: "function",
          function: { name: call.name, arguments: JSON.stringify(call.args ?? {}) },
        })),
      });
    } else if (responses.length) {
      for (const [index, response] of responses.entries()) {
        messages.push({ role: "tool", tool_call_id: response.id || `call_${index}`, content: JSON.stringify(response.response ?? {}) });
      }
    } else if (text) {
      messages.push({ role, content: text });
    }
  }

  const response = await fetch(GROQ_URL, {
    signal: AbortSignal.timeout(15_000),
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
      // gpt-oss models reason at length by default (~8s); low effort keeps replies quick.
      ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
      tools: functionDeclarations.map((declaration) => ({
        type: "function",
        function: {
          name: declaration.name,
          description: declaration.description,
          parameters: declaration.parametersJsonSchema,
        },
      })),
      tool_choice: "auto",
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Groq request failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message;
  const parts: NonNullable<Content["parts"]> = [];
  const content = message?.content ? keepFirstReply(message.content) : "";
  if (content) parts.push({ text: content });
  for (const call of message?.tool_calls ?? []) {
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(call.function?.arguments || "{}"); } catch { /* Invalid tool args are handled as empty input. */ }
    parts.push({ functionCall: { id: call.id, name: call.function?.name, args } });
  }
  return {
    candidates: [{ content: { role: "model", parts } }],
    text: content || undefined,
    functionCalls: parts.flatMap((part) => part.functionCall ? [part.functionCall] : []),
  } as GenerateContentResponse;
}
