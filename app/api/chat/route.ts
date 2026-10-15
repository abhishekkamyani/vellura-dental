import { GoogleGenAI, type Content } from "@google/genai";
import {
  buildSystemPrompt,
  executeTool,
  functionDeclarations,
  toolStatusLabel,
  type BookingConfirmation,
  type SlotSuggestions,
} from "@/lib/concierge";
import { generateWithRetry, isOverloaded } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";

type ChatMessage = { role: "user" | "assistant"; content: string };

/** Events streamed to the browser as newline-delimited JSON. */
export type ChatEvent =
  | { type: "status"; label: string }
  | { type: "reply"; reply: string; booking: BookingConfirmation | null; slots: SlotSuggestions | null }
  | { type: "error"; error: string; retryable: boolean };

const MAX_MESSAGES = 30;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_TOOL_ROUNDS = 6;

function parseMessages(body: unknown): ChatMessage[] | null {
  const raw = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(raw)) return null;
  const messages: ChatMessage[] = [];
  for (const item of raw.slice(-MAX_MESSAGES)) {
    const role = (item as ChatMessage)?.role;
    const content = (item as ChatMessage)?.content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string" || !content.trim()) return null;
    messages.push({ role, content: content.slice(0, MAX_MESSAGE_LENGTH) });
  }
  // Gemini conversations must open with a user turn.
  while (messages.length && messages[0].role === "assistant") messages.shift();
  return messages.length && messages[messages.length - 1].role === "user" ? messages : null;
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "The concierge is not configured yet. Add GEMINI_API_KEY to your .env file and restart the server." },
      { status: 503 },
    );
  }

  const limit = rateLimit(`chat:${clientIp(request.headers)}`, 20, 60_000);
  if (!limit.allowed) {
    return Response.json(
      { error: "You are sending messages very quickly. Please pause for a moment and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const messages = parseMessages(await request.json().catch(() => null));
  if (!messages) {
    return Response.json({ error: "Expected a messages array ending with a user message." }, { status: 400 });
  }

  const models = [
    process.env.GEMINI_MODEL || "gemini-flash-latest",
    process.env.GEMINI_FALLBACK_MODEL || "gemini-flash-lite-latest",
  ].filter((model, index, all) => all.indexOf(model) === index);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      let booking: BookingConfirmation | null = null;
      let slots: SlotSuggestions | null = null;

      try {
        const services = await prisma.service.findMany({ orderBy: { name: "asc" } });
        const ai = new GoogleGenAI({ apiKey });
        const config = {
          systemInstruction: buildSystemPrompt(services),
          tools: [{ functionDeclarations }],
          temperature: 0.4,
        };
        const contents: Content[] = messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const response = await generateWithRetry(ai, { contents, config }, models);

          const calls = response.functionCalls ?? [];
          if (calls.length === 0) {
            send({
              type: "reply",
              reply: response.text?.trim() || "My apologies, I did not quite catch that. Could you say it once more?",
              booking,
              // Once a booking is made there is nothing left to choose.
              slots: booking ? null : slots,
            });
            return;
          }

          // Echo the model turn back unchanged, then answer each call with its real result.
          const modelTurn = response.candidates?.[0]?.content;
          if (modelTurn) contents.push(modelTurn);

          const parts = [];
          for (const call of calls) {
            send({ type: "status", label: toolStatusLabel(call.name) });
            const outcome = await executeTool(call.name, call.args);
            if (outcome.booking) booking = outcome.booking;
            if (outcome.slots) slots = outcome.slots;
            parts.push({ functionResponse: { id: call.id, name: call.name, response: outcome.response } });
          }
          contents.push({ role: "user", parts });
        }

        send({
          type: "reply",
          reply: "My apologies, that took longer than expected. Could you kindly repeat your request?",
          booking,
          slots: booking ? null : slots,
        });
      } catch (error) {
        console.error("Chat route failed", error);
        // If the appointment was already written, say so rather than implying nothing happened.
        if (booking) {
          send({ type: "reply", reply: "Your appointment is confirmed. The details are below.", booking, slots: null });
        } else {
          send({
            type: "error",
            retryable: true,
            error: isOverloaded(error)
              ? "Our concierge is unusually busy at the moment. Please try again in a few seconds."
              : "Our concierge is momentarily unavailable. Please try again shortly.",
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
