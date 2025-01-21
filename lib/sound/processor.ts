/**
 * A custom `AudioWorkletProcessor`.
 */
class SoundProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, any>) {
    const inputCount = inputs.length;
    console.log("[SoundProcessor process] inputCount: ", inputCount);

    const sourceLimit = Math.min(inputs.length, outputs.length);

    // Perform audio processing
    // for (let inputNum = 0; inputNum < sourceLimit; inputNum++) {
    //   const input = inputs[inputNum];
    //   const output = outputs[inputNum];
    //   const channelCount = Math.min(input.length, output.length);

    //   for (let channelNum = 0; channelNum < channelCount; channelNum++) {
    //     input[channelNum].forEach((sample, i) => {
    //       // Manipulate the sample
    //       output[channelNum][i] = sample;
    //     });
    //   }
    // };

    return true;
  }
}

registerProcessor("sound-processor", SoundProcessor);