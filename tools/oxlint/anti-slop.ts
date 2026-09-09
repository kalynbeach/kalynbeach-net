import { definePlugin } from "@oxlint/plugins";
import { noChainedTypeAssertionsRule } from "./vendor/anti-slop/no-chained-type-assertions.ts";
import { noWidenThenAssertRule } from "./vendor/anti-slop/no-widen-then-assert.ts";

export default definePlugin({
  meta: { name: "anti-slop" },
  rules: {
    "no-chained-type-assertions": noChainedTypeAssertionsRule,
    "no-widen-then-assert": noWidenThenAssertRule,
  },
});
