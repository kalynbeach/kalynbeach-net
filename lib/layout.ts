/**
 * The desktop layout's media query, for code that must react to it in
 * JavaScript. It mirrors --breakpoint-desktop in app/globals.css, and
 * tests/layout.test.ts fails when the two drift apart.
 */
export const desktopMedia = "(width >= 68.75rem)";
