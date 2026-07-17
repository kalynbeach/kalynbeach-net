import { describe, expect, it } from "vitest";
import { buildPlaylistPatch } from "@/convex/lib/domain";

describe("buildPlaylistPatch", () => {
  it("preserves title during a description-only update", () => {
    expect(buildPlaylistPatch({ description: "new description" }, 100)).toEqual(
      {
        description: "new description",
        updatedAt: 100,
      }
    );
  });

  it("preserves description during a title-only update", () => {
    expect(buildPlaylistPatch({ title: "new title" }, 100)).toEqual({
      title: "new title",
      updatedAt: 100,
    });
  });

  it("uses an explicit null to clear an optional description", () => {
    expect(buildPlaylistPatch({ description: null }, 100)).toEqual({
      description: undefined,
      updatedAt: 100,
    });
  });
});
