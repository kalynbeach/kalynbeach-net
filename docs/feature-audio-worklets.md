# Feature: Audio Worklets

## TypeScript Worklets

It's possible to write AudioWorkletProcessor modules in TypeScript, but it requires some additional configuration since AudioWorklet modules need to be compiled and served as JavaScript files. Here's how you can set this up in your Next.js project:

1. First, create a separate TypeScript configuration file specifically for your worklet:

```typescript:tsconfig.worklet.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "lib": ["DOM", "ES2020", "WebWorker"],
    "outDir": "./public/worklets",
    "noEmit": false,
    "isolatedModules": false
  },
  "include": ["lib/sound/processor.ts"],
  "exclude": ["node_modules", ".next", "public"]
}
```

2. Add a build script in your package.json:

```json:package.json
{
  "scripts": {
    "build:worklet": "tsc --project tsconfig.worklet.json"
  }
}
```


3. Update your worklet TypeScript file with proper types:

```typescript:lib/sound/processor.ts
declare var AudioWorkletProcessor: {
  prototype: AudioWorkletProcessor;
  new (): AudioWorkletProcessor;
};

declare var registerProcessor: (
  name: string,
  processorCtor: typeof AudioWorkletProcessor
) => void;

class SoundProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean {
    const inputCount = inputs.length;
    const sourceLimit = Math.min(inputs.length, outputs.length);

    // Process audio
    for (let inputNum = 0; inputNum < sourceLimit; inputNum++) {
      const input = inputs[inputNum];
      const output = outputs[inputNum];
      const channelCount = Math.min(input.length, output.length);

      for (let channelNum = 0; channelNum < channelCount; channelNum++) {
        const inputChannel = input[channelNum];
        const outputChannel = output[channelNum];
        
        for (let i = 0; i < inputChannel.length; i++) {
          outputChannel[i] = inputChannel[i];
        }
      }
    }

    return true;
  }
}

registerProcessor("sound-processor", SoundProcessor);
```

4. Update your hook to use the compiled JavaScript file:

```typescript:hooks/sound/use-sound-processor.ts
const WORKLET_URL = process.env.NODE_ENV === "development" 
  ? "/worklets/processor.js"
  : `/worklets/processor.js?v=${process.env.BUILD_ID}`;
```

5. Add a build step in your Next.js build process. Create a custom build script:

```typescript:scripts/build-worklets.ts
import { build } from "esbuild";
import { resolve } from "path";

async function buildWorklets() {
  try {
    await build({
      entryPoints: [resolve("lib/sound/processor.ts")],
      bundle: true,
      outfile: "public/worklets/processor.js",
      format: "iife",
      target: "es2020",
      platform: "browser",
      minify: process.env.NODE_ENV === "production",
    });
    console.log("✅ Worklet built successfully");
  } catch (error) {
    console.error("❌ Error building worklet:", error);
    process.exit(1);
  }
}

buildWorklets();
```

6. Update your package.json build scripts:

```json:package.json
{
  "scripts": {
    "build:worklets": "tsx scripts/build-worklets.ts",
    "dev": "npm run build:worklets && next dev",
    "build": "npm run build:worklets && next build"
  }
}
```

7. Install required dev dependencies:

```bash
bun add -D esbuild tsx @types/audioworklet
```