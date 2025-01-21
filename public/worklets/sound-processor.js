class SoundProcessor extends AudioWorkletProcessor {
<<<<<<< HEAD

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
      for (let i = 0; i < inputChannel.length; i++) {
        outputChannel[i] = inputChannel[i];
      }
    }
=======
  constructor() {
    super();
  }

  process(inputs, outputs, parameters) {
    const inputCount = inputs.length;
    // console.log("[SoundProcessor process] inputCount: ", inputCount);

    const sourceLimit = Math.min(inputs.length, outputs.length);

    // for (let inputNum = 0; inputNum < sourceLimit; inputNum++) {
    //   const input = inputs[inputNum];
    //   const output = outputs[inputNum];
    //   const channelCount = Math.min(input.length, output.length);

    //   for (let channelNum = 0; channelNum < channelCount; channelNum++) {
    //     input[channelNum].forEach((sample, i) => {
    //       console.log(sample);
    //       output[channelNum][i] = sample;
    //     });
    //   }
    // }
>>>>>>> 792cdad (add initial sound-processor worklet and hook)

    return true;
  }
}

registerProcessor("sound-processor", SoundProcessor);