var Buffer = require('buffer/').Buffer;

export default class AudioPlayer {
    constructor(ws, onSpeaking, onListening) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext({ sampleRate: 17500 });
        this.audioData = [];
        this.ws = ws;
        this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
        this.processor.onaudioprocess = this.processAudio.bind(this);
        this.processor.connect(this.audioContext.destination); // Always connected
        this.marks = [];
        this.isCurrentlyPlaying = false;
        this.isPaused = false; // Added a flag to keep track of pause state
        this.updatePlayingState();
        this.onSpeakingCB = onSpeaking;   
        this.onListeningCB = onListening;        
    }

    enqueueAudio(base64Data) {
        const binaryData = Buffer(base64Data, 'base64');
        const audioSamples = this.pcm16ToFloat32(binaryData);
        this.audioData.push(...audioSamples);
    }

    processAudio(audioProcessingEvent) {
        if (this.isPaused) return; // Check if the playback is paused

        let outputBuffer = audioProcessingEvent.outputBuffer;

        for (let channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
            let outputData = outputBuffer.getChannelData(channel);
            let inputData = this.audioData.splice(0, outputData.length);

            if (inputData.length > 0) {
                outputData.set(inputData);
            } else {
                outputData.fill(0); // Output silence when no data is available
            }
        }

        this.updatePlayingState();
        this.processMarks();
    }

    updatePlayingState() {
        const wasPlaying = this.isCurrentlyPlaying;
        this.isCurrentlyPlaying = this.audioData.length > 0;

        if (wasPlaying !== this.isCurrentlyPlaying) {
            if (this.isCurrentlyPlaying === true) {
                if (this.onSpeakingCB) this.onSpeakingCB()
            } 
            if (this.isCurrentlyPlaying === false) {
                if (this.onListeningCB) this.onListeningCB()
            }         
        }
    }

    processMarks() {
        if (this.marks.length > 0 && this.audioData.length === 0) {
            const mark_name = this.marks.shift();
            this.ws.send(JSON.stringify({ event: 'mark', streamSid: 'WEBSDK', mark: { name: mark_name } }));
        }
    }

    stopAndClear() {
        this.audioData = [];
        this.marks = [];
        this.updatePlayingState();
    }

    addMark(mark_name) {
        this.marks.push(mark_name);
    }

    pause() {
        this.isPaused = true; // Set the flag to true to pause processing
    }

    resume() {
        this.isPaused = false; // Set the flag to false to resume processing
    }

    pcm16ToFloat32(pcm16Array) {
        const float32Array = new Float32Array(pcm16Array.length / 2);
        const dataView = new DataView(pcm16Array.buffer);
    
        for (let i = 0, j = 0; i < pcm16Array.byteLength; i += 2, j++) {
            const int16Sample = dataView.getInt16(i, true);
            float32Array[j] = int16Sample / 0x8000;
        }

        return float32Array;
    }
}
