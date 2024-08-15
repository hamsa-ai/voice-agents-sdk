class AudioProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (input && input[0]) {
      const inputData = input[0];
      const rawAudioData = new Float32Array(inputData.length);
      rawAudioData.set(inputData);
      const base64String = btoa(String.fromCharCode(...new Uint8Array(rawAudioData.buffer)));
      this.port.postMessage({
        event: 'media',
        streamSid: 'WEBSDK',
        media: {
          payload: base64String
        }
      });
    }
    return true;
  }
}
registerProcessor('audio-processor', AudioProcessor);