class AudioPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.audioData = [];
    this.isPaused = false;
    this.marks = [];
    this.port.onmessage = event => {
      if (event.data.type === 'enqueue') {
        this.audioData.push(...event.data.audioSamples);
      } else if (event.data.type === 'pause') {
        this.isPaused = true;
      } else if (event.data.type === 'resume') {
        this.isPaused = false;
      } else if (event.data.type === 'addMark') {
        this.marks.push(event.data.markName);
      } else if (event.data.type === 'clear') {
        this.audioData = [];
      }
    };
  }
  process(inputs, outputs) {
    const output = outputs[0];
    if (this.isPaused) {
      for (let channel = 0; channel < output.length; channel++) {
        output[channel].fill(0); // Output silence if paused
      }
      return true;
    }
    for (let channel = 0; channel < output.length; channel++) {
      const outputData = output[channel];
      const inputData = this.audioData.splice(0, outputData.length);
      if (inputData.length > 0) {
        outputData.set(inputData);
      } else {
        // outputData.fill(0); // Output silence when no data is available
        this.audioData = [];
      }
    }

    // Process marks if all audio data has been played
    if (this.marks.length > 0 && this.audioData.length === 0) {
      const mark_name = this.marks.shift();
      this.port.postMessage({
        type: 'mark',
        markName: mark_name
      });
    }
    return true; // Keep the processor active
  }
}
registerProcessor('audio-player-processor', AudioPlayerProcessor);