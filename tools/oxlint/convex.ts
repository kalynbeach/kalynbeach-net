import { definePlugin, defineRule } from "@oxlint/plugins";
import type { Context, ESTree, Scope } from "@oxlint/plugins";

const registrars = new Set([
  "query",
  "mutation",
  "action",
  "internalQuery",
  "internalMutation",
  "internalAction",
]);

function propertyName(node: ESTree.MemberExpression | ESTree.ObjectProperty) {
  const key = node.type === "MemberExpression" ? node.property : node.key;
  if (!node.computed && key.type === "Identifier") return key.name;
  return key.type === "Literal" && typeof key.value === "string"
    ? key.value
    : null;
}

// Resolve the imported registrar so aliases work and local names cannot trigger the rules.
function isRegistrarCall(node: ESTree.CallExpression, context: Context) {
  if (node.callee.type !== "Identifier") return false;
  let scope: Scope | null = context.sourceCode.getScope(node.callee);
  while (scope) {
    const variable = scope.set.get(node.callee.name);
    if (variable) {
      return variable.defs.some(
        ({ type, node: binding, parent }) =>
          type === "ImportBinding" &&
          binding.type === "ImportSpecifier" &&
          binding.imported.type === "Identifier" &&
          registrars.has(binding.imported.name) &&
          parent?.type === "ImportDeclaration" &&
          /(?:_generated\/server|convex\/server)(?:\.js)?$/.test(
            parent.source.value
          )
      );
    }
    scope = scope.upper;
  }
  return false;
}

function unwrap(node: ESTree.Expression): ESTree.Expression {
  switch (node.type) {
    case "AwaitExpression":
      return unwrap(node.argument);
    case "ChainExpression":
    case "ParenthesizedExpression":
    case "TSAsExpression":
    case "TSTypeAssertion":
    case "TSNonNullExpression":
    case "TSInstantiationExpression":
      return unwrap(node.expression);
    default:
      return node;
  }
}

// These checks recognize the db / ctx.db syntax used in this app, not receiver types.
function isDatabase(expression: ESTree.Expression) {
  const node = unwrap(expression);
  return (
    (node.type === "Identifier" && node.name === "db") ||
    (node.type === "MemberExpression" && propertyName(node) === "db")
  );
}

function isQuery(expression: ESTree.Expression): boolean {
  const node = unwrap(expression);
  if (node.type !== "CallExpression" || node.callee.type !== "MemberExpression")
    return false;
  const method = propertyName(node.callee);
  if (method === "query") return isDatabase(node.callee.object);
  if (
    method !== "withIndex" &&
    method !== "withSearchIndex" &&
    method !== "order" &&
    method !== "filter"
  )
    return false;
  return isQuery(node.callee.object);
}

const noOldFunctionSyntax = defineRule({
  meta: {
    type: "problem",
    schema: [],
    messages: {
      object:
        "Use object syntax for Convex functions so validators are explicit.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isRegistrarCall(node, context)) return;
        const argument = node.arguments[0];
        if (
          argument?.type === "ArrowFunctionExpression" ||
          argument?.type === "FunctionExpression"
        ) {
          context.report({ node: argument, messageId: "object" });
        }
      },
    };
  },
});

const requireArgsValidator = defineRule({
  meta: {
    type: "problem",
    schema: [],
    messages: {
      args: "Declare args validators on Convex functions, including args: {} when there are no arguments.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isRegistrarCall(node, context)) return;
        const argument = node.arguments[0];
        if (argument?.type !== "ObjectExpression") return;
        if (
          !argument.properties.some(
            (property) =>
              property.type === "Property" && propertyName(property) === "args"
          )
        ) {
          context.report({ node: argument, messageId: "args" });
        }
      },
    };
  },
});

const explicitTableIds = defineRule({
  meta: {
    type: "problem",
    schema: [],
    messages: {
      table: "Pass an explicit table name before the ID in db.{{method}}().",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type !== "MemberExpression" ||
          !isDatabase(node.callee.object)
        )
          return;
        const method = propertyName(node.callee);
        const expected =
          method === "get" || method === "delete"
            ? 2
            : method === "patch" || method === "replace"
              ? 3
              : null;
        if (expected !== null && node.arguments.length < expected) {
          context.report({ node, messageId: "table", data: { method } });
        }
      },
    };
  },
});

const noFilterInQuery = defineRule({
  meta: {
    type: "suggestion",
    schema: [],
    messages: {
      filter:
        "Prefer an indexed Convex query over filtering database results before collection.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type === "MemberExpression" &&
          propertyName(node.callee) === "filter" &&
          isQuery(node.callee.object)
        ) {
          context.report({ node: node.callee.property, messageId: "filter" });
        }
      },
    };
  },
});

export default definePlugin({
  meta: { name: "convex" },
  rules: {
    "no-old-registered-function-syntax": noOldFunctionSyntax,
    "require-args-validator": requireArgsValidator,
    "explicit-table-ids": explicitTableIds,
    "no-filter-in-query": noFilterInQuery,
  },
});
