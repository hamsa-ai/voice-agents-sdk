import { Buffer } from 'buffer';
import AudioPlayerProcessor from './audio-player-processor.worklet.js';

export default class AudioPlayer {
    /**
     * Constructs a new AudioPlayer instance.
     * @param {WebSocket} ws - The WebSocket connection.
     * @param {function} onSpeaking - Callback when speaking starts.
     * @param {function} onListening - Callback when listening starts.
     * @param {function} onStreamReady - Callback when MediaStream is ready.
     */
    constructor(ws, onSpeaking, onListening, onStreamReady) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext({ sampleRate: 16000 });
        this.ws = ws;
        this.isPaused = false;
        this.onSpeakingCB = onSpeaking;
        this.onListeningCB = onListening;
        this.isPlaying = false;

        // Create a gain node for volume control
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = 1.0; // Set default volume to 100%
        
        // Create a MediaStreamDestination node to capture audio data
        this.mediaStreamDestination = this.audioContext.createMediaStreamDestination();
        
        // Connect GainNode to both destination and MediaStreamDestination
        this.gainNode.connect(this.audioContext.destination); // Speakers
        this.gainNode.connect(this.mediaStreamDestination); // MediaStream

        this.onStreamReady = onStreamReady;

        this.initAudioWorklet();
    }

    /**
     * Initializes the AudioWorklet and sets up the processor.
     */
    async initAudioWorklet() {
        try {
            await this.audioContext.audioWorklet.addModule(AudioPlayerProcessor);
            this.processor = new AudioWorkletNode(
                this.audioContext,
                "audio-player-processor"
            );
            this.processor.port.onmessage = (event) => {
                if (event.data.type === "mark") {
                    this.ws.send(
                        JSON.stringify({
                            event: "mark",
                            streamSid: "WEBSDK",
                            mark: { name: event.data.markName },
                        })
                    );
                } else if (event.data.type === "finished") {
                    this.updatePlayingState(false);
                }
            };
    
            // Connect processor to the gain node
            this.processor.connect(this.gainNode);

            // Notify that the MediaStream is ready
            if (this.onStreamReady) {
                this.onStreamReady(this.getMediaStream());
            }
        } catch (e) {
            console.error('Failed to load AudioWorklet module', e);
        }
    }

    /**
     * Enqueues audio data to be played.
     * @param {string} base64Data - Base64 encoded PCM16 audio data.
     */
    enqueueAudio(base64Data) {
        const binaryData = Buffer.from(base64Data, 'base64');
        const audioSamples = this.pcm16ToFloat32(binaryData);
        this.processor.port.postMessage({ type: 'enqueue', audioSamples });
        this.updatePlayingState(true);
    }

    /**
     * Pauses audio playback.
     */
    pause() {
        this.isPaused = true;
        this.processor.port.postMessage({ type: 'pause' });
    }

    /**
     * Resumes audio playback.
     */
    resume() {
        this.isPaused = false;
        this.processor.port.postMessage({ type: 'resume' });
    }

    /**
     * Stops audio playback and clears the buffer.
     */
    stopAndClear() {
        this.processor.port.postMessage({ type: 'clear' });
        this.updatePlayingState(false);        
    }

    /**
     * Adds a mark to the audio stream.
     * @param {string} markName - Name of the mark.
     */
    addMark(markName) {
        this.processor.port.postMessage({ type: 'addMark', markName });
    }

    /**
     * Converts PCM16 data to Float32.
     * @param {Uint8Array} pcm16Array - PCM16 audio data.
     * @returns {Float32Array} Float32 audio samples.
     */
    pcm16ToFloat32(pcm16Array) {
        const float32Array = new Float32Array(pcm16Array.length / 2);
        const dataView = new DataView(pcm16Array.buffer);
    
        for (let i = 0, j = 0; i < pcm16Array.byteLength; i += 2, j++) {
            const int16Sample = dataView.getInt16(i, true);
            float32Array[j] = int16Sample / 0x8000;
        }

        return float32Array;
    }

    /**
     * Updates the playing state and triggers callbacks.
     * @param {boolean} isPlaying - Indicates whether audio is playing.
     */
    updatePlayingState(isPlaying) {
        if (isPlaying && !this.isPlaying) {
            this.isPlaying = true;
            if (this.onSpeakingCB) this.onSpeakingCB(); // Trigger the speaking callback
        } else if (!isPlaying && this.isPlaying) {
            this.isPlaying = false;
            if (this.onListeningCB) this.onListeningCB(); // Trigger the listening callback
        }
    }    

    /**
     * Sets the volume of the audio playback.
     * @param {number} volume - Volume level between 0.0 and 1.0.
     */
    setVolume(volume) {
        const clampedVolume = Math.min(1.0, Math.max(0.0, volume)); // Clamp volume between 0.0 and 1.0
        this.gainNode.gain.setValueAtTime(
            clampedVolume,
            this.audioContext.currentTime
        );
    }    

    /**
     * Returns the MediaStream capturing the audio being played.
     * @returns {MediaStream}
     */
    getMediaStream() {
        return this.mediaStreamDestination.stream;
    }
}