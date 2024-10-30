export default class AudioPlayer {
    /**
     * Constructs a new AudioPlayer instance.
     * @param {WebSocket} ws - The WebSocket connection.
     * @param {function} onSpeaking - Callback when speaking starts.
     * @param {function} onListening - Callback when listening starts.
     * @param {function} onStreamReady - Callback when MediaStream is ready.
     */
    constructor(ws: WebSocket, onSpeaking: Function, onListening: Function, onStreamReady: Function);
    audioContext: any;
    ws: WebSocket;
    isPaused: boolean;
    onSpeakingCB: Function;
    onListeningCB: Function;
    isPlaying: boolean;
    gainNode: any;
    mediaStreamDestination: any;
    onStreamReady: Function;
    /**
     * Initializes the AudioWorklet and sets up the processor.
     */
    initAudioWorklet(): Promise<void>;
    processor: AudioWorkletNode;
    /**
     * Enqueues audio data to be played.
     * @param {string} base64Data - Base64 encoded PCM16 audio data.
     */
    enqueueAudio(base64Data: string): void;
    /**
     * Pauses audio playback.
     */
    pause(): void;
    /**
     * Resumes audio playback.
     */
    resume(): void;
    /**
     * Stops audio playback and clears the buffer.
     */
    stopAndClear(): void;
    /**
     * Adds a mark to the audio stream.
     * @param {string} markName - Name of the mark.
     */
    addMark(markName: string): void;
    /**
     * Converts PCM16 data to Float32.
     * @param {Uint8Array} pcm16Array - PCM16 audio data.
     * @returns {Float32Array} Float32 audio samples.
     */
    pcm16ToFloat32(pcm16Array: Uint8Array): Float32Array;
    /**
     * Updates the playing state and triggers callbacks.
     * @param {boolean} isPlaying - Indicates whether audio is playing.
     */
    updatePlayingState(isPlaying: boolean): void;
    /**
     * Sets the volume of the audio playback.
     * @param {number} volume - Volume level between 0.0 and 1.0.
     */
    setVolume(volume: number): void;
    /**
     * Returns the MediaStream capturing the audio being played.
     * @returns {MediaStream}
     */
    getMediaStream(): MediaStream;
}
