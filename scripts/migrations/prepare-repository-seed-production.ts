import { runPreparationCli } from "@/lib/migrations/production";

const outputDirectory = await runPreparationCli({
  argv: Bun.argv,
  environment: process.env,
});

console.log(`validated migration files written to ${outputDirectory}`);
