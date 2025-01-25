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
    // this.port.postMessage("[SoundProcessor constructor] initialized!");
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    for (let channelNum = 0; channelNum < input.length; channelNum++) {
      const inputChannel = input[channelNum];
      const outputChannel = output[channelNum];

      // this.port.postMessage(inputChannel);

      // TODO: implement sample processing
      // for (let i = 0; i < inputChannel.length; i++) {
      //   outputChannel[i] = inputChannel[i];
      // }
    }

    return true;
  }
}

registerProcessor("sound-processor", SoundProcessor);