import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/convex/_generated/api";
import { fetchPublicQuery } from "@/lib/convex/server";

vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));

const track = {
  id: "1",
  title: "Take",
  src: "https://example.test/take.wav",
  artist: "KKB",
  record: "",
  duration: 8,
  peaks: [0.2, 1],
};

const convexFetch = vi.fn<typeof fetch>();

function answer(value: unknown) {
  return new Response(JSON.stringify({ status: "success", value }));
}

/** A request Convex never answers. Like fetch, it rejects once its signal aborts. */
function hang(_input: RequestInfo | URL, init?: RequestInit) {
  return new Promise<Response>((_, reject) =>
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))
  );
}

describe("fetchPublicQuery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv(
      "NEXT_PUBLIC_CONVEX_URL",
      "https://happy-otter-123.convex.cloud"
    );
    vi.stubGlobal("fetch", convexFetch);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    convexFetch.mockReset();
  });

  it("returns the query's value", async () => {
    convexFetch.mockResolvedValueOnce(answer([track]));

    await expect(fetchPublicQuery(api.tracks.list, {}, [])).resolves.toEqual([
      track,
    ]);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("returns the fallback and logs when Convex fails", async () => {
    convexFetch.mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(fetchPublicQuery(api.tracks.list, {}, [])).resolves.toEqual(
      []
    );
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("returns the fallback once Convex has not answered in 1 s", async () => {
    convexFetch.mockImplementationOnce(hang);

    const result = fetchPublicQuery(api.tracks.list, {}, []);

    await vi.advanceTimersByTimeAsync(999);
    expect(console.error).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual([]);
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("aborts the request to Convex at the deadline", async () => {
    convexFetch.mockImplementationOnce(hang);

    const result = fetchPublicQuery(api.tracks.list, {}, []);

    await vi.advanceTimersByTimeAsync(0);
    const signal = convexFetch.mock.calls[0]?.[1]?.signal;

    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1_000);
    await result;
    expect(signal?.aborted).toBe(true);
  });
});
