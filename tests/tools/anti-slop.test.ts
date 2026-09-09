// @vitest-environment node
import { describe, it } from "vitest";
import { RuleTester } from "oxlint/plugins-dev";
import plugin from "../../tools/oxlint/anti-slop";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;
const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "ts" } },
});

tester.run(
  "anti-slop/no-chained-type-assertions",
  plugin.rules["no-chained-type-assertions"],
  {
    valid: [
      "const value = input as User;",
      "const value = ({ id: 1 } as const) as const;",
      "function parse(input: unknown) { return typeof input === 'object'; }",
    ],
    invalid: [
      {
        code: "const value = input as unknown as User;",
        errors: [{ messageId: "chained" }],
      },
      {
        code: "const value = (input as unknown) as User;",
        errors: [{ messageId: "chained" }],
      },
      {
        code: "const value = <User>(<unknown>input);",
        errors: [{ messageId: "chained" }],
      },
    ],
  }
);

tester.run(
  "anti-slop/no-widen-then-assert",
  plugin.rules["no-widen-then-assert"],
  {
    valid: [
      "function parse(input: unknown) { return input as User; }",
      "const value: User = { id: 1 }; const result = value;",
      "let value: unknown = { id: 1 }; value = read(); const result = value as User;",
    ],
    invalid: [
      {
        code: "const value: unknown = { id: 1 }; const result = value as User;",
        errors: [{ messageId: "widenThenAssert" }],
      },
      {
        code: "const original: User = read(); const value = original as unknown; const result = value as User;",
        errors: [{ messageId: "widenThenAssert" }],
      },
    ],
  }
);
