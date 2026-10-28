import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchQuery } from "convex/nextjs";
import { connection } from "next/server";
import { readLiveLook } from "@/components/looks/read";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("convex/nextjs", () => ({ fetchQuery: vi.fn() }));

const stored = { look: { color: "magenta" } };

beforeEach(() => {
  vi.mocked(connection).mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("readLiveLook", () => {
  it("returns the live look's stored config", async () => {
    vi.mocked(fetchQuery).mockResolvedValue(stored);

    await expect(readLiveLook()).resolves.toBe(stored);
  });

  it("returns null, which draws the default, when the read fails", async () => {
    vi.mocked(fetchQuery).mockRejectedValue(new Error("Server Error"));

    await expect(readLiveLook()).resolves.toBeNull();
  });

  it("returns null when Convex answers after 1000 ms", async () => {
    vi.useFakeTimers();
    vi.mocked(fetchQuery).mockReturnValue(new Promise(() => {}));

    let answered = false;
    const read = readLiveLook().finally(() => {
      answered = true;
    });

    await vi.advanceTimersByTimeAsync(999);
    expect(answered).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(read).resolves.toBeNull();
  });

  it("lets connection() end a prerender without reading Convex", async () => {
    const prerender = new Error("prerender bail-out");
    vi.mocked(connection).mockRejectedValue(prerender);

    await expect(readLiveLook()).rejects.toBe(prerender);
    expect(fetchQuery).not.toHaveBeenCalled();
  });
});
