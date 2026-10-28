import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { fetchPublicQuery } from "@/lib/convex/server";

vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("convex/nextjs", () => ({
  fetchMutation: vi.fn(),
  fetchQuery: vi.fn(),
}));

const query = vi.mocked(fetchQuery);
const track = {
  id: "1",
  title: "Take",
  src: "https://example.test/take.wav",
  artist: "KKB",
  record: "",
  duration: 8,
  peaks: [0.2, 1],
};

describe("fetchPublicQuery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns the query's value", async () => {
    query.mockResolvedValueOnce([track]);

    await expect(fetchPublicQuery(api.tracks.list, {}, [])).resolves.toEqual([
      track,
    ]);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("returns the fallback and logs when Convex fails", async () => {
    query.mockRejectedValueOnce(new Error("Convex is down"));

    await expect(fetchPublicQuery(api.tracks.list, {}, [])).resolves.toEqual(
      []
    );
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("returns the fallback once Convex has not answered in 1 s", async () => {
    query.mockReturnValueOnce(new Promise(() => {}));

    const result = fetchPublicQuery(api.tracks.list, {}, []);

    await vi.advanceTimersByTimeAsync(999);
    expect(console.error).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual([]);
    expect(console.error).toHaveBeenCalledOnce();
  });
});
