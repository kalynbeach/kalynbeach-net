import { runImportCli } from "@/lib/migrations/import-production";

await runImportCli({ argv: Bun.argv, environment: process.env });
