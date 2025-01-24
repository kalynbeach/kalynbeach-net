/**
 * A custom `AudioWorkletProcessor`.
 */
class SoundProcessor extends AudioWorkletProcessor {

  static get parameterDescriptors() {
    return [
      {
        name: "sound",
        defaultValue: 0.93,
      }
    ];
  }

  constructor() {
    super();
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, any>) {
    const input = inputs[0];
    const output = outputs[0];

    for (let channelNum = 0; channelNum < input.length; channelNum++) {
      const inputChannel = input[channelNum];
      const outputChannel = output[channelNum];

      // TODO: implement sample processing
      for (let i = 0; i < inputChannel.length; i++) {
        outputChannel[i] = inputChannel[i];
      }
    }

    return true;
  }
}

registerProcessor("sound-processor", SoundProcessor);