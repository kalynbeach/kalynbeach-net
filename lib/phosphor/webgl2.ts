import { MAX_TRACES } from "./presets";
import { MAX_POINTS, POINT_FLOATS, type FrameBuffer } from "./frame-buffer";
import { SCREEN_UNIFORM_FLOATS } from "./exposure";
import {
  BEAM_FRAGMENT,
  BEAM_VERTEX,
  COMPOSITE_FRAGMENTS,
  FADE_FRAGMENT,
  FULLSCREEN_VERTEX,
  LINE_FRAGMENT,
  LINE_VERTEX,
  RESAMPLE_FRAGMENT,
  SCREEN_BINDING,
} from "./glsl";
import type { AcquireRenderer, Renderer } from "./renderer";
import type { BeamStyle, Ground } from "./types";

const POINT_BYTES = POINT_FLOATS * 4;

/** Floats per trace in the trace table: emission rgb, shoulder rgb. */
const TRACE_FLOATS = 6;

const CONTEXT: WebGLContextAttributes = {
  alpha: true,
  antialias: false,
  depth: false,
  premultipliedAlpha: true,
  preserveDrawingBuffer: false,
};

export const acquireWebGl2: AcquireRenderer = async (canvas, onLost) => {
  const gl = canvas.getContext("webgl2", CONTEXT);

  // Null when WebGL2 is missing or the canvas has another kind of context.
  if (!gl) return { kind: "missing" };

  // Before the extension check: a lost context reports no extensions, and
  // a failure retries where a missing backend ends the screen.
  if (gl.isContextLost())
    return { kind: "failed", message: "The WebGL2 context is lost." };

  // WebGL2 is the last backend tried, so the context this leaves on the
  // canvas blocks no other backend.
  if (!gl.getExtension("EXT_color_buffer_float")) return { kind: "missing" };
  let renderer: Renderer;

  try {
    renderer = build(gl, canvas, onLost);
  } catch (error) {
    return {
      kind: "failed",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  return { kind: "ready", renderer };
};

type History = {
  readonly texture: WebGLTexture;
  readonly framebuffer: WebGLFramebuffer;
  readonly width: number;
  readonly height: number;
};

type TraceUniforms = {
  readonly emission: WebGLUniformLocation | null;
  readonly shoulder: WebGLUniformLocation | null;
};

function build(
  gl: WebGL2RenderingContext,
  canvas: HTMLCanvasElement,
  onLost: Parameters<AcquireRenderer>[1]
): Renderer {
  const shaders: WebGLShader[] = [];
  const programs: WebGLProgram[] = [];

  const compile = (type: GLenum, source: string) => {
    const shader = gl.createShader(type);

    if (!shader) throw new Error("WebGL2 could not create a shader.");
    shaders.push(shader);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    return shader;
  };

  const link = (vertex: string, fragment: string) => {
    const program = gl.createProgram();
    programs.push(program);
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const logs = gl
        .getAttachedShaders(program)
        ?.map((shader) => gl.getShaderInfoLog(shader))
        .join("\n");

      throw new Error(
        `WebGL2 could not link a shader program: ${gl.getProgramInfoLog(program)}\n${logs}`
      );
    }

    const block = gl.getUniformBlockIndex(program, "Screen");

    if (block !== gl.INVALID_INDEX)
      gl.uniformBlockBinding(program, block, SCREEN_BINDING);

    return program;
  };

  const fadeProgram = link(FULLSCREEN_VERTEX, FADE_FRAGMENT);
  const lineProgram = link(LINE_VERTEX, LINE_FRAGMENT);
  const beamProgram = link(BEAM_VERTEX, BEAM_FRAGMENT);
  const resampleProgram = link(FULLSCREEN_VERTEX, RESAMPLE_FRAGMENT);

  const traceUniforms = (program: WebGLProgram): TraceUniforms => ({
    emission: gl.getUniformLocation(program, "traceEmission"),
    shoulder: gl.getUniformLocation(program, "traceShoulder"),
  });

  const lineTrace = traceUniforms(lineProgram);
  const beamTrace = traceUniforms(beamProgram);

  // Every sampler reads texture unit 0, the default; set it anyway so the binding is explicit.
  const linkComposite = (ground: Ground) => {
    const program = link(FULLSCREEN_VERTEX, COMPOSITE_FRAGMENTS[ground]);
    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, "history"), 0);

    return program;
  };

  // Linked up front, so a ground whose composite fails to link fails acquisition.
  const compositePrograms = {
    screen: linkComposite("screen"),
    dark: linkComposite("dark"),
    light: linkComposite("light"),
  } as const satisfies Record<Ground, WebGLProgram>;

  let compositeProgram = compositePrograms.screen;
  gl.useProgram(resampleProgram);
  gl.uniform1i(gl.getUniformLocation(resampleProgram, "source"), 0);

  const uniformBuffer = gl.createBuffer();
  gl.bindBuffer(gl.UNIFORM_BUFFER, uniformBuffer);
  gl.bufferData(gl.UNIFORM_BUFFER, SCREEN_UNIFORM_FLOATS * 4, gl.DYNAMIC_DRAW);

  const pointBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, MAX_POINTS * POINT_BYTES, gl.DYNAMIC_DRAW);

  const lineArray = gl.createVertexArray();
  gl.bindVertexArray(lineArray);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, POINT_BYTES, 0);

  // Both attributes step per instance; deposit() points them at each strip.
  const beamArray = gl.createVertexArray();
  gl.bindVertexArray(beamArray);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribDivisor(0, 1);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribDivisor(1, 1);
  gl.bindVertexArray(null);

  const traces = new Float32Array(MAX_TRACES * TRACE_FLOATS);
  // GLES dithers by default and WebGPU never does. Context state, so once per context.
  gl.disable(gl.DITHER);

  const createHistory = (width: number, height: number): History => {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

    if (status !== gl.FRAMEBUFFER_COMPLETE && !gl.isContextLost()) {
      gl.deleteFramebuffer(framebuffer);
      gl.deleteTexture(texture);

      throw new Error(
        `The RGBA16F history is not renderable (framebuffer status 0x${status.toString(16)}).`
      );
    }

    return { texture, framebuffer, width: w, height: h };
  };

  const deleteHistory = (target: History) => {
    gl.deleteFramebuffer(target.framebuffer);
    gl.deleteTexture(target.texture);
  };

  const viewportDims: Int32Array = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
  const maxTexture: number = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const maxRenderbuffer: number = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);

  const maxSize = Math.min(
    maxTexture,
    maxRenderbuffer,
    viewportDims[0],
    viewportDims[1]
  );

  // The canvas may still be larger than this context allows; the screen
  // resizes it to maxSize at the next frame.
  let history = createHistory(
    Math.min(canvas.width, maxSize),
    Math.min(canvas.height, maxSize)
  );

  let alive = true;

  /** Binds the history as the render target, with blending off. */
  const bindHistory = () => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, history.framebuffer);
    gl.viewport(0, 0, history.width, history.height);
    gl.disable(gl.BLEND);
  };

  /** Draws the full-screen triangle with `program`, sampling `source` on unit 0. */
  const fullscreen = (program: WebGLProgram, source: WebGLTexture | null) => {
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, source);
    gl.bindVertexArray(null);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const writeUniforms = (uniforms: Float32Array) => {
    gl.bindBufferBase(gl.UNIFORM_BUFFER, SCREEN_BINDING, uniformBuffer);
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, uniforms);
  };

  const drawComposite = () => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.disable(gl.BLEND);
    fullscreen(compositeProgram, history.texture);
  };

  const setTrace = (locations: TraceUniforms, trace: number) => {
    const at = trace * TRACE_FLOATS;
    gl.uniform3fv(locations.emission, traces, at, 3);
    gl.uniform3fv(locations.shoulder, traces, at + 3, 3);
  };

  const deposit = (beam: BeamStyle, geometry: FrameBuffer) => {
    const { strips } = geometry;
    const line = beam === "line";
    const locations = line ? lineTrace : beamTrace;
    gl.useProgram(line ? lineProgram : beamProgram);
    gl.bindVertexArray(line ? lineArray : beamArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);

    for (let strip = 0; strip < geometry.stripCount(); strip += 1) {
      const first = strips[strip * 3];
      const count = strips[strip * 3 + 1];

      if (count < (line ? 2 : 1)) continue;
      setTrace(locations, strips[strip * 3 + 2]);

      if (line) {
        gl.drawArrays(gl.LINE_STRIP, first, count);
        continue;
      }

      // Instance i reads p0 = point first + i and p1 = point first + i + 1.
      // A lone point reads itself twice, a stationary spot of energy dt.
      const second = count === 1 ? first : first + 1;
      gl.vertexAttribPointer(
        0,
        2,
        gl.FLOAT,
        false,
        POINT_BYTES,
        first * POINT_BYTES
      );

      gl.vertexAttribPointer(
        1,
        4,
        gl.FLOAT,
        false,
        POINT_BYTES,
        second * POINT_BYTES
      );

      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, Math.max(1, count - 1));
    }
  };

  // Report a loss once, and keep the context restorable: a lost context
  // whose event is not default-prevented never comes back. The screen waits
  // for the restore under its own signal, because it destroys this renderer
  // before the restore comes and may stop waiting before it does.
  const onContextLost = (event: Event) => {
    event.preventDefault();

    const restored = (signal: AbortSignal) =>
      new Promise<void>((resolve) => {
        canvas.addEventListener("webglcontextrestored", () => resolve(), {
          once: true,
          signal,
        });
      });

    if (alive) onLost({ message: "The WebGL2 context was lost.", restored });
  };

  canvas.addEventListener("webglcontextlost", onContextLost, { once: true });

  return {
    backend: "webgl2",
    maxSize,
    resize(width, height) {
      const previous = history;
      history = createHistory(width, height);
      bindHistory();
      fullscreen(resampleProgram, previous.texture);
      deleteHistory(previous);
    },
    setTraces(resolved) {
      resolved.forEach((trace, index) => {
        traces.set(trace.emission, index * TRACE_FLOATS);
        traces.set(trace.shoulder, index * TRACE_FLOATS + 3);
      });
    },
    setOutput({ ground }) {
      compositeProgram = compositePrograms[ground];

      return false;
    },
    draw(uniforms, beam, geometry) {
      writeUniforms(uniforms);
      const used = geometry.pointCount() * POINT_FLOATS;

      if (used > 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, geometry.points, 0, used);
      }

      bindHistory();
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);

      gl.blendFuncSeparate(
        gl.ZERO,
        gl.ONE_MINUS_SRC_COLOR,
        gl.ONE,
        gl.ONE_MINUS_SRC_ALPHA
      );

      fullscreen(fadeProgram, null);
      gl.blendFunc(gl.ONE, gl.ONE);
      deposit(beam, geometry);
      drawComposite();
    },
    composite(uniforms) {
      writeUniforms(uniforms);
      drawComposite();
    },
    clear(level) {
      bindHistory();
      gl.clearColor(level, level, level, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    },
    destroy() {
      if (!alive) return;
      alive = false;
      canvas.removeEventListener("webglcontextlost", onContextLost);
      // Free this renderer's objects only. The context stays: it belongs to
      // the canvas, and a restored context is acquired again.
      deleteHistory(history);
      gl.deleteVertexArray(lineArray);
      gl.deleteVertexArray(beamArray);
      gl.deleteBuffer(pointBuffer);
      gl.deleteBuffer(uniformBuffer);

      for (const program of programs) gl.deleteProgram(program);

      for (const shader of shaders) gl.deleteShader(shader);
    },
  };
}
