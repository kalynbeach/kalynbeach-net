// @vitest-environment node
import { describe, it } from "vitest";
import { RuleTester } from "oxlint/plugins-dev";
import plugin from "../../tools/oxlint/convex";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;
const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "ts" } },
});
const imports =
  'import { query, mutation, internalAction as register } from "./_generated/server";';

tester.run(
  "convex/no-old-registered-function-syntax",
  plugin.rules["no-old-registered-function-syntax"],
  {
    valid: [
      `${imports} export const list = query({ args: {}, handler: async (ctx) => [] });`,
      "const query = (handler) => handler; export const local = query(() => []);",
      `${imports} function local(query) { return query(() => []); }`,
    ],
    invalid: [
      {
        code: `${imports} export const list = query(async (ctx) => []);`,
        errors: [{ messageId: "object" }],
      },
      {
        code: `${imports} export const task = register(function (ctx) {});`,
        errors: [{ messageId: "object" }],
      },
    ],
  }
);

tester.run(
  "convex/require-args-validator",
  plugin.rules["require-args-validator"],
  {
    valid: [
      `${imports} export const list = query({ args: {}, handler: (ctx) => [] });`,
      `${imports} export const task = register({ "args": {}, handler: () => null });`,
      "const query = (options) => options; export const local = query({handler: () => []});",
    ],
    invalid: [
      {
        code: `${imports} export const list = query({ handler: (ctx) => [] });`,
        errors: [{ messageId: "args" }],
      },
      {
        code: `${imports} export const task = register({ handler: () => null });`,
        errors: [{ messageId: "args" }],
      },
      {
        code: `${imports} export const save = mutation({ handler: (ctx, args) => args });`,
        errors: [{ messageId: "args" }],
      },
    ],
  }
);

tester.run("convex/explicit-table-ids", plugin.rules["explicit-table-ids"], {
  valid: [
    'ctx.db.get("tracks", id); ctx.db.delete("tracks", id); ctx.db.patch("tracks", id, {}); ctx.db.replace("tracks", id, {});',
    'db["get"]("tracks", id);',
    "cache.get(id); cache.delete(id); object.patch(id, {});",
    // Database aliases require type information and are outside this syntax rule's coverage.
    "const database = ctx.db; database.get(id);",
  ],
  invalid: [
    ...["get", "delete"].map((method) => ({
      code: `ctx.db.${method}(id);`,
      errors: [{ messageId: "table" }],
    })),
    ...["patch", "replace"].map((method) => ({
      code: `ctx.db.${method}(id, {});`,
      errors: [{ messageId: "table" }],
    })),
    { code: 'db["get"](id);', errors: [{ messageId: "table" }] },
  ],
});

tester.run("convex/no-filter-in-query", plugin.rules["no-filter-in-query"], {
  valid: [
    'ctx.db.query("tracks").collect().filter(predicate);',
    '(await ctx.db.query("tracks").collect()).filter(predicate);',
    'ctx.db.query("tracks").take(10).filter(predicate);',
    'ctx.db.query("tracks").paginate(options).page.filter(predicate);',
    "playlistTracks.filter(predicate);",
    // Query-variable tracking is outside the previous untyped rule and this replacement.
    'const records = ctx.db.query("tracks"); records.filter(predicate);',
  ],
  invalid: [
    {
      code: 'ctx.db.query("tracks").filter(predicate);',
      errors: [{ messageId: "filter" }],
    },
    {
      code: '(ctx.db.query("tracks")!).filter(predicate);',
      errors: [{ messageId: "filter" }],
    },
    {
      code: '(ctx.db.query("tracks") as Query).filter(predicate);',
      errors: [{ messageId: "filter" }],
    },
    {
      code: 'db.query("tracks").withIndex("by_id", index).order("asc").filter(predicate);',
      errors: [{ messageId: "filter" }],
    },
  ],
});
