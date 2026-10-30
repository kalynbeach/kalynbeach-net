export const NOISE_COLORS = ["white", "pink", "brown"] as const;

export const NOISE_PEAK = 0.5;

export const NOISE_PROCESSOR = "kevelle-noise-1";

export const NOISE_RMS = 0.1;

export const TAP_CHUNK_FRAMES = 256;

export const TAP_HEADER_LENGTH = 4;

export const TAP_PACKET_LENGTH = 516;

export const TAP_POOL_SIZE = 32;

export const TAP_PROCESSOR = "kevelle-tap-1";

export const WORKLET_SOURCE = `// worklets/protocol.ts
var TAP_PROCESSOR = "kevelle-tap-1";
var NOISE_PROCESSOR = "kevelle-noise-1";
var TAP_CHUNK_FRAMES = 256;
var TAP_POOL_SIZE = 32;
var TAP_HEADER_LENGTH = 4;
var TAP_PACKET_LENGTH = TAP_HEADER_LENGTH + 2 * TAP_CHUNK_FRAMES;
var NOISE_COLORS = ["white", "pink", "brown"];
var NOISE_RMS = 0.1;
var NOISE_PEAK = 0.5;

// worklets/noise.ts
var PINK_POLES = [0.99886, 0.99332, 0.969, 0.8665, 0.55, -0.7616];
var PINK_INPUTS = [
  0.0555179,
  0.0750759,
  0.153852,
  0.3104856,
  0.5329522,
  -0.016898
];
var PINK_DIRECT = 0.5362;
var PINK_DELAYED = 0.115926;
var BROWN_CORNER_HZ = 20;
function pinkGain() {
  let energy = 0;
  let first = 0;
  let second = 0;
  for (let i = 0;i < PINK_POLES.length; i += 1) {
    first += PINK_INPUTS[i];
    second += PINK_INPUTS[i] * PINK_POLES[i];
    for (let j = 0;j < PINK_POLES.length; j += 1) {
      energy += PINK_INPUTS[i] * PINK_INPUTS[j] / (1 - PINK_POLES[i] * PINK_POLES[j]);
    }
  }
  energy += 2 * PINK_DIRECT * first + PINK_DIRECT ** 2 + 2 * PINK_DELAYED * second + PINK_DELAYED ** 2;
  return NOISE_RMS / Math.sqrt(energy / 3);
}
var PINK_GAIN = pinkGain();
var WHITE_GAIN = NOISE_RMS * Math.sqrt(3);
function scramble(seed) {
  let state = seed | 0;
  state = Math.imul(state ^ state >>> 16, 2246822507);
  state = Math.imul(state ^ state >>> 13, 3266489909);
  state ^= state >>> 16;
  return state === 0 ? 1831565813 : state;
}

class NoiseChannel {
  #state;
  #pink = [0, 0, 0, 0, 0, 0, 0];
  #brown = 0;
  #leak;
  #brownGain;
  constructor(seed, sampleRate2) {
    this.#state = scramble(seed);
    this.#leak = Math.exp(-2 * Math.PI * BROWN_CORNER_HZ / sampleRate2);
    this.#brownGain = NOISE_RMS / Math.sqrt((1 - this.#leak) ** 2 * (1 / 3) / (1 - this.#leak ** 2));
  }
  #white() {
    let state = this.#state;
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    this.#state = state;
    return (state >>> 0) / 2147483648 - 1;
  }
  fill(out, color) {
    switch (color) {
      case "white": {
        for (let index = 0;index < out.length; index += 1)
          out[index] = WHITE_GAIN * this.#white();
        return;
      }
      case "pink": {
        const b = this.#pink;
        for (let index = 0;index < out.length; index += 1) {
          const white = this.#white();
          let sum = PINK_DIRECT * white + b[6];
          for (let pole = 0;pole < 6; pole += 1) {
            b[pole] = PINK_POLES[pole] * b[pole] + PINK_INPUTS[pole] * white;
            sum += b[pole];
          }
          b[6] = PINK_DELAYED * white;
          out[index] = PINK_GAIN * sum;
        }
        return;
      }
      case "brown": {
        const leak = this.#leak;
        for (let index = 0;index < out.length; index += 1) {
          this.#brown = leak * this.#brown + (1 - leak) * this.#white();
          out[index] = this.#brownGain * this.#brown;
        }
        return;
      }
    }
  }
}

class Noise {
  #color;
  #left;
  #right;
  constructor(options, sampleRate2) {
    this.#color = options.color;
    this.#left = new NoiseChannel(options.seed, sampleRate2);
    this.#right = new NoiseChannel(options.seed ^ 1540483477, sampleRate2);
  }
  receive(control) {
    this.#color = control === "stop" ? null : control;
  }
  process(output) {
    const color = this.#color;
    if (color === null)
      return false;
    if (output.length > 0)
      this.#left.fill(output[0], color);
    if (output.length > 1)
      this.#right.fill(output[1], color);
    for (let side = 0;side < Math.min(output.length, 2); side += 1) {
      const channel = output[side];
      for (let index = 0;index < channel.length; index += 1)
        channel[index] = Math.min(NOISE_PEAK, Math.max(-NOISE_PEAK, channel[index]));
    }
    return true;
  }
}

// worklets/tap.ts
var RIGHT = TAP_HEADER_LENGTH + TAP_CHUNK_FRAMES;

class Tap {
  #post;
  #pool = [];
  #packet = null;
  #fill = 0;
  #dropped = 0;
  #active = true;
  #finished = false;
  #nextFrame = 0;
  constructor(post) {
    this.#post = post;
    for (let index = 0;index < TAP_POOL_SIZE; index += 1)
      this.#pool.push(new Float64Array(TAP_PACKET_LENGTH));
  }
  receive(control) {
    if (control === null) {
      this.#finished = true;
      return;
    }
    if (control instanceof Float64Array)
      this.#pool.push(control);
    else
      this.#active = control;
  }
  process(input, frame) {
    if (this.#finished) {
      this.#flush();
      return false;
    }
    const channels = Math.min(input.length, 2);
    if (!this.#active || channels === 0) {
      this.#flush();
      return true;
    }
    const left = input[0];
    const right = input[1];
    frame = Math.max(frame, this.#nextFrame);
    this.#nextFrame = frame + left.length;
    let offset = 0;
    while (offset < left.length) {
      let packet = this.#packet;
      if (packet !== null && (packet[1] !== channels || packet[0] + this.#fill !== frame + offset)) {
        this.#flush();
        packet = null;
      }
      if (packet === null) {
        const next = this.#pool.pop();
        if (next === undefined) {
          this.#dropped += left.length - offset;
          return true;
        }
        packet = next;
        packet[0] = frame + offset;
        packet[1] = channels;
        packet[3] = this.#dropped;
        this.#dropped = 0;
        this.#fill = 0;
        this.#packet = packet;
      }
      const count = Math.min(left.length - offset, TAP_CHUNK_FRAMES - this.#fill);
      const start = TAP_HEADER_LENGTH + this.#fill;
      for (let index = 0;index < count; index += 1)
        packet[start + index] = left[offset + index];
      if (channels === 2) {
        for (let index = 0;index < count; index += 1)
          packet[RIGHT + this.#fill + index] = right[offset + index];
      }
      this.#fill += count;
      offset += count;
      if (this.#fill === TAP_CHUNK_FRAMES)
        this.#flush();
    }
    return true;
  }
  #flush() {
    const packet = this.#packet;
    if (packet === null)
      return;
    packet[2] = this.#fill;
    this.#packet = null;
    this.#post(packet);
  }
}

// worklets/register.ts
function isTapControl(data) {
  return data === null || data === true || data === false || data instanceof Float64Array && data.length === TAP_PACKET_LENGTH;
}
function isNoiseMessage(data) {
  return Number.isInteger(data) && Number(data) >= -1 && Number(data) < NOISE_COLORS.length;
}
function isNoiseOptions(data) {
  return data instanceof Object && "color" in data && "seed" in data && isNoiseMessage(data.color) && data.color >= 0 && Number.isInteger(data.seed);
}

class TapProcessor extends AudioWorkletProcessor {
  #transfer = [];
  #tap = new Tap((packet) => {
    this.#transfer[0] = packet.buffer;
    this.port.postMessage(packet, this.#transfer);
  });
  constructor() {
    super();
    this.port.onmessage = (event) => {
      if (isTapControl(event.data))
        this.#tap.receive(event.data);
    };
  }
  process(inputs) {
    return this.#tap.process(inputs[0], currentFrame);
  }
}

class NoiseProcessor extends AudioWorkletProcessor {
  #noise;
  constructor(options) {
    super();
    const settings = options.processorOptions;
    if (!isNoiseOptions(settings))
      throw new TypeError("kevelle-noise needs processorOptions { color, seed }");
    this.#noise = new Noise({ color: NOISE_COLORS[settings.color], seed: settings.seed }, sampleRate);
    this.port.onmessage = (event) => {
      if (!isNoiseMessage(event.data))
        return;
      const control = event.data === -1 ? "stop" : NOISE_COLORS[event.data];
      this.#noise.receive(control);
    };
  }
  process(_inputs, outputs) {
    return this.#noise.process(outputs[0]);
  }
}
registerProcessor(TAP_PROCESSOR, TapProcessor);
registerProcessor(NOISE_PROCESSOR, NoiseProcessor);
`;
