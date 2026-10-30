import { MAX_TRACES } from "./presets";
import { MAX_POINTS, POINT_FLOATS, type FrameBuffer } from "./frame-buffer";
import { SCREEN_UNIFORM_FLOATS } from "./exposure";
import type { AcquireRenderer, Output, Renderer } from "./renderer";
import type { BeamStyle } from "./types";
import {
  BEAM_WGSL,
  COMPOSITE_WGSL,
  FADE_WGSL,
  LINE_WGSL,
  RESAMPLE_WGSL,
  TRACE_UNIFORM_STRIDE,
} from "./wgsl";

const BUFFER_COPY_DST = 0x0008;

const BUFFER_VERTEX = 0x0020;

const BUFFER_UNIFORM = 0x0040;

const TEXTURE_TEXTURE_BINDING = 0x0004;

const TEXTURE_RENDER_ATTACHMENT = 0x0010;

const STAGE_VERTEX = 0x1;

const STAGE_FRAGMENT = 0x2;

const HISTORY_FORMAT: GPUTextureFormat = "rgba16float";

const POINT_BYTES = POINT_FLOATS * 4;

const ADDITIVE: GPUBlendState = {
  color: { srcFactor: "one", dstFactor: "one", operation: "add" },
  alpha: { srcFactor: "one", dstFactor: "one", operation: "add" },
};

const FADE: GPUBlendState = {
  color: { srcFactor: "zero", dstFactor: "one-minus-src", operation: "add" },
  alpha: {
    srcFactor: "one",
    dstFactor: "one-minus-src-alpha",
    operation: "add",
  },
};

/** Devices a renderer destroyed itself. Their loss is expected, not one to recover from. */
const destroyed = new WeakSet<GPUDevice>();

export const acquireWebGpu: AcquireRenderer = async (canvas, onLost) => {
  const adapter = await navigator.gpu?.requestAdapter().catch(() => null);

  if (!adapter) return { kind: "missing" };
  // requestDevice consumes the adapter, so every acquisition asks for a fresh one.
  const device = await adapter.requestDevice().catch(() => null);

  if (!device) return { kind: "missing" };
  const context = canvas.getContext("webgpu");

  if (!(context instanceof GPUCanvasContext)) {
    device.destroy();

    return {
      kind: "failed",
      message: "The canvas already has another kind of context.",
    };
  }

  device.pushErrorScope("out-of-memory");
  device.pushErrorScope("validation");
  let renderer: Renderer;

  try {
    renderer = build(device, context, canvas);
  } catch (error) {
    device.destroy();

    return {
      kind: "failed",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  const invalid = await device.popErrorScope();
  const outOfMemory = await device.popErrorScope();
  const failure = invalid ?? outOfMemory;

  if (failure) {
    renderer.destroy();

    return { kind: "failed", message: failure.message };
  }

  const logged = new Set<string>();
  device.addEventListener("uncapturederror", (event) => {
    const { message } = event.error;

    if (logged.has(message)) return;
    logged.add(message);
    console.error("[kevelle/phosphor]", message);
  });
  // device.lost resolves for any loss. Only the renderer's own destroy() is
  // expected; an outside device.destroy() is a loss to recover from. Report
  // on a later task: a device lost before this function returns, which
  // requestDevice allows, resolves here first, and the screen ignores a loss
  // from a renderer it has not adopted yet.
  void device.lost.then((info) =>
    setTimeout(() => {
      if (!destroyed.has(device))
        onLost({ message: info.message || info.reason });
    })
  );

  return { kind: "ready", renderer };
};

type History = {
  readonly texture: GPUTexture;
  readonly view: GPUTextureView;
  /** Binds the texture and the sampler, for the composite and for resampling it into a resized history. */
  readonly group: GPUBindGroup;
};

function build(
  device: GPUDevice,
  context: GPUCanvasContext,
  canvas: HTMLCanvasElement
): Renderer {
  const sdrFormat = navigator.gpu.getPreferredCanvasFormat();
  const maxSize = device.limits.maxTextureDimension2D;

  const sampler = device.createSampler({
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    magFilter: "linear",
    minFilter: "linear",
  });

  const uniformBuffer = device.createBuffer({
    size: SCREEN_UNIFORM_FLOATS * 4,
    usage: BUFFER_UNIFORM | BUFFER_COPY_DST,
  });

  const traceBuffer = device.createBuffer({
    size: MAX_TRACES * TRACE_UNIFORM_STRIDE,
    usage: BUFFER_UNIFORM | BUFFER_COPY_DST,
  });

  const pointBuffer = device.createBuffer({
    size: MAX_POINTS * POINT_BYTES,
    usage: BUFFER_VERTEX | BUFFER_COPY_DST,
  });

  const screenLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: STAGE_VERTEX | STAGE_FRAGMENT,
        buffer: { type: "uniform" },
      },
    ],
  });

  const traceLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: STAGE_FRAGMENT,
        buffer: { type: "uniform", hasDynamicOffset: true, minBindingSize: 32 },
      },
    ],
  });

  const historyLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: STAGE_FRAGMENT, texture: {} },
      { binding: 1, visibility: STAGE_FRAGMENT, sampler: {} },
    ],
  });

  const screenGroup = device.createBindGroup({
    layout: screenLayout,
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  const traceGroup = device.createBindGroup({
    layout: traceLayout,
    entries: [{ binding: 0, resource: { buffer: traceBuffer, size: 32 } }],
  });

  const layout = (...groups: GPUBindGroupLayout[]) =>
    device.createPipelineLayout({ bindGroupLayouts: groups });

  const fullscreen = (
    code: string,
    pipelineLayout: GPUPipelineLayout,
    format: GPUTextureFormat,
    blend?: GPUBlendState
  ) => {
    const shader = device.createShaderModule({ code });

    return device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: { module: shader, entryPoint: "vs" },
      fragment: {
        module: shader,
        entryPoint: "fs",
        targets: [{ format, blend }],
      },
      primitive: { topology: "triangle-list" },
    });
  };

  const fadePipeline = fullscreen(
    FADE_WGSL,
    layout(screenLayout),
    HISTORY_FORMAT,
    FADE
  );

  const lineModule = device.createShaderModule({ code: LINE_WGSL });

  const linePipeline = device.createRenderPipeline({
    layout: layout(screenLayout, traceLayout),
    vertex: {
      module: lineModule,
      entryPoint: "vs",
      buffers: [
        {
          arrayStride: POINT_BYTES,
          attributes: [{ format: "float32x2", offset: 0, shaderLocation: 0 }],
        },
      ],
    },
    fragment: {
      module: lineModule,
      entryPoint: "fs",
      targets: [{ format: HISTORY_FORMAT, blend: ADDITIVE }],
    },
    primitive: { topology: "line-strip" },
  });

  const beamModule = device.createShaderModule({ code: BEAM_WGSL });

  const beamPipeline = device.createRenderPipeline({
    layout: layout(screenLayout, traceLayout),
    vertex: {
      module: beamModule,
      entryPoint: "vs",
      buffers: [
        {
          arrayStride: POINT_BYTES,
          stepMode: "instance",
          attributes: [{ format: "float32x2", offset: 0, shaderLocation: 0 }],
        },
        {
          arrayStride: POINT_BYTES,
          stepMode: "instance",
          attributes: [{ format: "float32x4", offset: 0, shaderLocation: 1 }],
        },
      ],
    },
    fragment: {
      module: beamModule,
      entryPoint: "fs",
      targets: [{ format: HISTORY_FORMAT, blend: ADDITIVE }],
    },
    primitive: { topology: "triangle-list" },
  });

  const compositeLayout = layout(screenLayout, historyLayout);
  // Built on first use, keyed by source. Each source has one format: SDR
  // sources draw to sdrFormat, HDR sources to rgba16float.
  const composites = new Map<string, GPURenderPipeline>();

  const compositeFor = (code: string, format: GPUTextureFormat) => {
    const built = composites.get(code);

    if (built) return built;
    const pipeline = fullscreen(code, compositeLayout, format);
    composites.set(code, pipeline);

    return pipeline;
  };

  // Inside acquireWebGpu's error scope, so a bad composite fails acquisition.
  let composite = compositeFor(COMPOSITE_WGSL.screen.sdr, sdrFormat);

  const resamplePipeline = fullscreen(
    RESAMPLE_WGSL,
    layout(historyLayout),
    HISTORY_FORMAT
  );

  const createHistory = (width: number, height: number): History => {
    const texture = device.createTexture({
      format: HISTORY_FORMAT,
      size: { width: Math.max(1, width), height: Math.max(1, height) },
      usage: TEXTURE_RENDER_ATTACHMENT | TEXTURE_TEXTURE_BINDING,
    });

    const view = texture.createView();

    const group = device.createBindGroup({
      layout: historyLayout,
      entries: [
        { binding: 0, resource: view },
        { binding: 1, resource: sampler },
      ],
    });

    return { texture, view, group };
  };

  // The canvas may still be larger than this device allows; the screen
  // resizes it to maxSize at the next frame.
  let history = createHistory(
    Math.min(canvas.width, maxSize),
    Math.min(canvas.height, maxSize)
  );

  let hdr = false;
  let clearAlpha = 1;
  let alive = true;

  const configure = ({ ground, hdr: wantHdr }: Output) => {
    const sources = COMPOSITE_WGSL[ground];
    const alphaMode = ground === "screen" ? "opaque" : "premultiplied";
    clearAlpha = ground === "screen" ? 1 : 0;

    if (wantHdr && sources.hdr) {
      try {
        context.configure({
          device,
          format: "rgba16float",
          alphaMode,
          toneMapping: { mode: "extended" },
        });

        if (context.getConfiguration()?.toneMapping?.mode === "extended") {
          composite = compositeFor(sources.hdr, "rgba16float");
          hdr = true;

          return;
        }
      } catch {
        // Firefox throws on an rgba16float canvas; fall through to SDR.
      }
    }

    context.configure({ device, format: sdrFormat, alphaMode });
    composite = compositeFor(sources.sdr, sdrFormat);
    hdr = false;
  };

  const historyPass = (encoder: GPUCommandEncoder, clear: number | null) =>
    encoder.beginRenderPass({
      colorAttachments: [
        {
          view: history.view,
          loadOp: clear === null ? "load" : "clear",
          clearValue: { r: clear ?? 0, g: clear ?? 0, b: clear ?? 0, a: 1 },
          storeOp: "store",
        },
      ],
    });

  const encodeComposite = (encoder: GPUCommandEncoder) => {
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          loadOp: "clear",
          clearValue: { r: 0, g: 0, b: 0, a: clearAlpha },
          storeOp: "store",
        },
      ],
    });

    pass.setPipeline(composite);
    pass.setBindGroup(0, screenGroup);
    pass.setBindGroup(1, history.group);
    pass.draw(3);
    pass.end();
  };

  const deposit = (
    pass: GPURenderPassEncoder,
    beam: BeamStyle,
    geometry: FrameBuffer
  ) => {
    const { strips } = geometry;
    pass.setBindGroup(0, screenGroup);

    if (beam === "line") {
      pass.setPipeline(linePipeline);
      pass.setVertexBuffer(0, pointBuffer);
    } else {
      pass.setPipeline(beamPipeline);
      pass.setVertexBuffer(0, pointBuffer, 0);
      pass.setVertexBuffer(1, pointBuffer, POINT_BYTES);
    }

    for (let strip = 0; strip < geometry.stripCount(); strip += 1) {
      const first = strips[strip * 3];
      const count = strips[strip * 3 + 1];
      const offset = strips[strip * 3 + 2] * TRACE_UNIFORM_STRIDE;

      if (beam === "line") {
        if (count < 2) continue;
        pass.setBindGroup(1, traceGroup, [offset]);
        pass.draw(count, 1, first, 0);
      } else if (count === 1) {
        // Both slots read a lone point, which draws a stationary spot of energy dt.
        pass.setBindGroup(1, traceGroup, [offset]);
        pass.setVertexBuffer(1, pointBuffer, 0);
        pass.draw(6, 1, 0, first);
        pass.setVertexBuffer(1, pointBuffer, POINT_BYTES);
      } else if (count > 1) {
        pass.setBindGroup(1, traceGroup, [offset]);
        pass.draw(6, count - 1, 0, first);
      }
    }
  };

  return {
    backend: "webgpu",
    maxSize,
    resize(width, height) {
      const previous = history;
      history = createHistory(width, height);
      const encoder = device.createCommandEncoder();
      const pass = historyPass(encoder, 0);
      pass.setPipeline(resamplePipeline);
      pass.setBindGroup(0, previous.group);
      pass.draw(3);
      pass.end();
      device.queue.submit([encoder.finish()]);
      previous.texture.destroy();
    },
    setTraces(traces) {
      const data = new Float32Array((MAX_TRACES * TRACE_UNIFORM_STRIDE) / 4);

      traces.forEach((trace, index) => {
        const at = (index * TRACE_UNIFORM_STRIDE) / 4;
        data.set(trace.emission, at);
        data.set(trace.shoulder, at + 4);
      });

      device.queue.writeBuffer(traceBuffer, 0, data);
    },
    setOutput(output) {
      configure(output);

      return hdr;
    },
    draw(uniforms, beam, geometry) {
      device.queue.writeBuffer(uniformBuffer, 0, uniforms);
      const used = geometry.pointCount() * POINT_FLOATS;

      if (used > 0)
        device.queue.writeBuffer(pointBuffer, 0, geometry.points, 0, used);
      const encoder = device.createCommandEncoder();
      const pass = historyPass(encoder, null);
      pass.setPipeline(fadePipeline);
      pass.setBindGroup(0, screenGroup);
      pass.draw(3);
      deposit(pass, beam, geometry);
      pass.end();
      encodeComposite(encoder);
      device.queue.submit([encoder.finish()]);
    },
    composite(uniforms) {
      device.queue.writeBuffer(uniformBuffer, 0, uniforms);
      const encoder = device.createCommandEncoder();
      encodeComposite(encoder);
      device.queue.submit([encoder.finish()]);
    },
    clear(level) {
      const encoder = device.createCommandEncoder();
      historyPass(encoder, level).end();
      device.queue.submit([encoder.finish()]);
    },
    destroy() {
      if (!alive) return;
      alive = false;
      destroyed.add(device);
      history.texture.destroy();
      device.destroy();
    },
  };
}
