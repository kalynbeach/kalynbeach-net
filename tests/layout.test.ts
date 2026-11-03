import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { desktopMedia } from "@/lib/layout";

const css = readFileSync(
  join(import.meta.dirname, "../app/globals.css"),
  "utf8"
);
const token = css.match(/--breakpoint-desktop:\s*([^;]+);/)?.[1].trim();

describe("desktop breakpoint", () => {
  test("the JavaScript media query matches the CSS token", () => {
    expect(token).toBeDefined();
    expect(desktopMedia).toBe(`(width >= ${token})`);
  });

  // Layout E needs 1200px for three sections with 36px outer margins.
  test("the desktop layout starts at 1200px", () => {
    const rem = Number(token?.match(/^([\d.]+)rem$/)?.[1]);
    expect(rem * 16).toBe(1200);
  });
});
