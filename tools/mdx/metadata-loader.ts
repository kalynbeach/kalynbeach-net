import { createProcessor } from "@mdx-js/mdx";

const processor = createProcessor();

/**
 * Turbopack loader for `<file>.mdx?metadata`. Returns the file's
 * `export const metadata` statement and drops its imports and body, so a page
 * that reads a project's title and lede gets none of the components its body
 * renders. @next/mdx's own rule then compiles the result. Throws when the
 * file has no such export, which fails the build.
 */
export default function metadataLoader(
  this: { resourcePath: string },
  source: string
): string {
  const statement = processor
    .parse(source)
    .children.flatMap((node) =>
      node.type === "mdxjsEsm" ? (node.data?.estree?.body ?? []) : []
    )
    .find(
      (statement) =>
        statement.type === "ExportNamedDeclaration" &&
        statement.declaration?.type === "VariableDeclaration" &&
        statement.declaration.declarations.some(
          ({ id }) => id.type === "Identifier" && id.name === "metadata"
        )
    );
  if (!statement?.range) {
    throw new Error(`${this.resourcePath} has no \`export const metadata\``);
  }
  return source.slice(...statement.range);
}
