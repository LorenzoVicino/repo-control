import { afterEach, describe, expect, it, vi } from "vitest";
import { isRecord, jsonRequest, requestJson } from "./http";

describe("HTTP helpers", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns parsed JSON and creates JSON request bodies", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true })
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestJson("/api/health", "failed")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/health", undefined);
    expect(jsonRequest("POST", { value: 1 })).toEqual({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: 1 })
    });
  });

  it.each([
    [{ message: "specific message" }, "specific message"],
    [{ error: "specific error" }, "specific error"],
    [{ unexpected: true }, "fallback"],
    [null, "fallback"]
  ])("extracts a safe API error from %j", async (payload, expectedMessage) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => payload
    }));

    await expect(requestJson("/api/failure", "fallback")).rejects.toThrow(expectedMessage);
  });

  it("uses the fallback when an error response is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => Promise.reject(new Error("invalid json"))
    }));

    await expect(requestJson("/api/failure", "fallback")).rejects.toThrow("fallback");
    expect(isRecord([])).toBe(true);
    expect(isRecord(null)).toBe(false);
  });
});
