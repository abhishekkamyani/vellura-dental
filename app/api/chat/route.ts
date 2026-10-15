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
import { generateWithGroq } from "@/lib/groq";
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

// The service list rarely changes; avoid a database round trip on every message.
let servicesCache: { at: number; value: Awaited<ReturnType<typeof prisma.service.findMany>> } | null = null;
async function getServices() {
  if (servicesCache && Date.now() - servicesCache.at < 60_000) return servicesCache.value;
  const value = await prisma.service.findMany({ orderBy: { name: "asc" } });
  servicesCache = { at: Date.now(), value };
  return value;
}

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
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!apiKey && !groqApiKey) {
    return Response.json(
      { error: "The concierge is not configured yet. Add GEMINI_API_KEY or GROQ_API_KEY to your .env file and restart the server." },
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
        const started = Date.now();
        const services = await getServices();
        console.log(`chat: services loaded in ${Date.now() - started}ms`);
        const ai = apiKey ? new GoogleGenAI({ apiKey, httpOptions: { timeout: 8_000 } }) : null;
        const config = {
          systemInstruction: buildSystemPrompt(services),
          tools: [{ functionDeclarations }],
          temperature: 0.4,
        };
        const contents: Content[] = messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
        // Groq answers fastest and most reliably, so it goes first; Gemini is the backup.
        // Tapping a time button sends "<time> on <date>, please"; the picker must not reappear after that.
        const pickedTime = /^\d{1,2}:\d{2} [AP]M on .+, please$/i.test(messages[messages.length - 1].content.trim());
        let useGroq = Boolean(groqApiKey);
        const groqModel = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          let response;
          if (useGroq) {
            try {
              response = await generateWithGroq(groqApiKey!, groqModel, config.systemInstruction, contents);
            } catch (error) {
              if (!ai) throw error;
              console.warn("Groq is unavailable; continuing the request with Gemini.", error);
              useGroq = false;
              response = await generateWithRetry(ai, { contents, config }, models);
            }
          } else {
            response = await generateWithRetry(ai!, { contents, config }, models);
          }

          const calls = response.functionCalls ?? [];
          if (calls.length === 0) {
            send({
              type: "reply",
              reply: response.text?.trim() || "My apologies, I did not quite catch that. Could you say it once more?",
              booking,
              // Nothing left to choose once a booking is made or the patient has tapped a time.
              slots: booking || pickedTime ? null : slots,
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
          slots: booking || pickedTime ? null : slots,
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
