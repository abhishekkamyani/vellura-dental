import { ApiError, type GoogleGenAI } from "@google/genai";
import { generateWithRetry } from "@/lib/gemini";
import { rateLimit } from "@/lib/rate-limit";

const overloaded = () => new ApiError({ status: 503, message: "This model is currently experiencing high demand." });

function fakeAi(generateContent: jest.Mock) {
  return { models: { generateContent } } as unknown as GoogleGenAI;
}

describe("generateWithRetry", () => {
  it("retries the same model after a temporary overload", async () => {
    const generate = jest.fn().mockRejectedValueOnce(overloaded()).mockResolvedValueOnce({ text: "hello" });

    const response = await generateWithRetry(fakeAi(generate), { contents: [] }, ["primary", "fallback"]);

    expect(response.text).toBe("hello");
    expect(generate.mock.calls.map(([params]) => params.model)).toEqual(["primary", "primary"]);
  });

  it("switches to the fallback model when the primary stays overloaded", async () => {
    const generate = jest
      .fn()
      .mockRejectedValueOnce(overloaded())
      .mockRejectedValueOnce(overloaded())
      .mockResolvedValueOnce({ text: "from fallback" });

    const response = await generateWithRetry(fakeAi(generate), { contents: [] }, ["primary", "fallback"]);

    expect(response.text).toBe("from fallback");
    expect(generate.mock.calls.map(([params]) => params.model)).toEqual(["primary", "primary", "fallback"]);
  });

  it("does not retry errors that will not resolve themselves", async () => {
    const generate = jest.fn().mockRejectedValue(new ApiError({ status: 400, message: "Bad request" }));

    await expect(generateWithRetry(fakeAi(generate), { contents: [] }, ["primary", "fallback"])).rejects.toMatchObject({ status: 400 });
    expect(generate).toHaveBeenCalledTimes(1);
  });
});

describe("rateLimit", () => {
  it("allows requests up to the limit, then blocks until the window resets", () => {
    const key = `test:${Math.random()}`;
    expect(rateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(rateLimit(key, 2, 60_000).allowed).toBe(true);

    const blocked = rateLimit(key, 2, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });
});
