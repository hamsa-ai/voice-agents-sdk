class AudioPlayerProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.audioData = [];
        this.isPaused = false;
        this.marks = [];
        this.isDone = false;

        this.port.onmessage = (event) => {
            if (event.data.type === 'enqueue') {
                this.audioData.push(...event.data.audioSamples);
                this.isPaused = false;
                this.isDone = false;
            } else if (event.data.type === 'pause') {
                this.isPaused = true;
            } else if (event.data.type === 'resume') {
                this.isPaused = false;
            } else if (event.data.type === 'addMark') {
                this.marks.push(event.data.markName);
            } else if (event.data.type === 'clear') {
                this.clearAllData();
            }
        };
    }

    clearAllData() {
        this.audioData = []; // Clear the audio data buffer
        this.marks = []; // Clear any pending marks
        this.isPaused = true; // Optionally, pause processing to ensure no data is played
    }

    process(inputs, outputs) {
        const output = outputs[0];

        if (this.isPaused) {
            for (let channel = 0; channel < output.length; channel++) {
                output[channel].fill(0); // Output silence if paused or cleared
            }
            return true;
        }

        for (let channel = 0; channel < output.length; channel++) {
            const outputData = output[channel];
            const inputData = this.audioData.splice(0, outputData.length);

            if (inputData.length > 0) {
                outputData.set(inputData);
            } else {
                outputData.fill(0); // Output silence when no data is available
            }
        }
        if (this.audioData.length === 0 && !this.isDone) {
            this.isDone = true; 
            this.port.postMessage({ type: 'finished' });
        }
        
        // Process marks if all audio data has been played
        if (this.marks.length > 0 && this.audioData.length === 0) {
            const mark_name = this.marks.shift();
            this.port.postMessage({ type: 'mark', markName: mark_name });
        }



        return true; // Keep the processor active
    }
}

registerProcessor('audio-player-processor', AudioPlayerProcessor);
