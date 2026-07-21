import { describe, expect, it, vi } from "vitest";
import { getConvexToken, type ClerkAuthState } from "@/lib/convex/clerk-token";

function sessionClaims(
  claims: Record<string, unknown>
): ClerkAuthState["sessionClaims"] {
  return claims as ClerkAuthState["sessionClaims"];
}

describe("getConvexToken", () => {
  it("uses the Clerk session token for the first-class Convex integration", async () => {
    const getToken = vi.fn().mockResolvedValue("session-token");

    await expect(
      getConvexToken({
        userId: "user_123",
        sessionClaims: sessionClaims({ aud: "convex" }),
        getToken,
      })
    ).resolves.toBe("session-token");
    expect(getToken).toHaveBeenCalledOnce();
    expect(getToken).toHaveBeenCalledWith();
  });

  it.each([undefined, "another-service"])(
    "fails closed when the audience is %s",
    async (audience) => {
      const getToken = vi.fn();

      await expect(
        getConvexToken({
          userId: "user_123",
          sessionClaims: audience
            ? sessionClaims({ aud: audience })
            : sessionClaims({}),
          getToken,
        })
      ).rejects.toThrow('Clerk session token audience must be "convex"');
      expect(getToken).not.toHaveBeenCalled();
    }
  );

  it("does not request a token for a signed-out request", async () => {
    const getToken = vi.fn();

    await expect(
      getConvexToken({
        userId: null,
        sessionClaims: null,
        getToken,
      })
    ).resolves.toBeNull();
    expect(getToken).not.toHaveBeenCalled();
  });

  it("fails closed when Clerk does not issue a token", async () => {
    const getToken = vi.fn().mockResolvedValue(null);

    await expect(
      getConvexToken({
        userId: "user_123",
        sessionClaims: sessionClaims({ aud: "convex" }),
        getToken,
      })
    ).rejects.toThrow("Clerk did not issue a Convex token");
  });
});
