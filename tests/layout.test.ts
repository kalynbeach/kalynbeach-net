import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { desktopMedia } from "@/lib/layout";

describe("desktop breakpoint", () => {
  test("the JavaScript media query matches the CSS token", () => {
    const css = readFileSync(
      join(import.meta.dirname, "../app/globals.css"),
      "utf8"
    );
    const token = css.match(/--breakpoint-desktop:\s*([^;]+);/)?.[1].trim();

    expect(token).toBeDefined();
    expect(desktopMedia).toBe(`(width >= ${token})`);
  });
});
