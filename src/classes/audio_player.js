import { Buffer } from 'buffer';
import AudioPlayerProcessor from './audio-player-processor.worklet.js';

export default class AudioPlayer {
    constructor(ws, onSpeaking, onListening) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext({ sampleRate: 16000 });
        this.ws = ws;
        this.isPaused = false; // Added a flag to keep track of pause state
        this.onSpeakingCB = onSpeaking;   
        this.onListeningCB = onListening;
        this.isPlaying = false;
        this.initAudioWorklet();
    }

    async initAudioWorklet() {
        this.audioContext.audioWorklet.addModule(AudioPlayerProcessor).then(() => {
            this.processor = new AudioWorkletNode(this.audioContext, 'audio-player-processor');
            this.processor.port.onmessage = (event) => {
                if (event.data.type === 'mark') {
                    this.ws.send(JSON.stringify({ event: 'mark', streamSid: 'WEBSDK', mark: { name: event.data.markName } }));
                } else if (event.data.type === 'finished') {
                    this.updatePlayingState(false);
                }
            };
    
            this.processor.connect(this.audioContext.destination);
        })
    }

    enqueueAudio(base64Data) {
        const binaryData = Buffer.from(base64Data, 'base64');
        const audioSamples = this.pcm16ToFloat32(binaryData);
        this.processor.port.postMessage({ type: 'enqueue', audioSamples });
        this.updatePlayingState(true);
    }

    pause() {
        this.isPaused = true;
        this.processor.port.postMessage({ type: 'pause' });
    }

    resume() {
        this.isPaused = false;
        this.processor.port.postMessage({ type: 'resume' });
    }

    stopAndClear() {
        this.processor.port.postMessage({ type: 'clear' });
        this.updatePlayingState(false);        
    }

    addMark(markName) {
        this.processor.port.postMessage({ type: 'addMark', markName });
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

    updatePlayingState(isPlaying) {
        if (isPlaying && !this.isPlaying) {
            this.isPlaying = true;
            if (this.onSpeakingCB) this.onSpeakingCB(); // Trigger the speaking callback
        } else if (!isPlaying && this.isPlaying) {
            this.isPlaying = false;
            if (this.onListeningCB) this.onListeningCB(); // Trigger the listening callback
        }
    }    
}
