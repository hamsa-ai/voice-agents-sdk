export default class AudioRecorder {
    /**
     * Constructs a new AudioRecorder instance.
     * @param {function} onStreamReady - Callback invoked when MediaStream is ready.
     */
    constructor(onStreamReady: Function);
    audioContext: any;
    mediaStreamSource: any;
    audioWorkletNode: AudioWorkletNode;
    mediaStream: MediaStream;
    isPaused: boolean;
    mediaStreamDestination: any;
    onStreamReady: Function;
    /**
     * Starts streaming audio by capturing from the microphone and sending it over WebSocket.
     * @param {WebSocket} ws - The WebSocket connection.
     * @returns {Promise<void>}
     */
    startStreaming(ws: WebSocket): Promise<void>;
    /**
     * Pauses audio streaming.
     */
    pause(): void;
    /**
     * Resumes audio streaming.
     */
    resume(): void;
    /**
     * Stops audio streaming and releases resources.
     */
    stop(): void;
    /**
     * Returns the MediaStream capturing the local audio being recorded.
     * @returns {MediaStream | null}
     */
    getMediaStream(): MediaStream | null;
}
