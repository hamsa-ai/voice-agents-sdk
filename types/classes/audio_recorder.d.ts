export default class AudioRecorder {
    audioContext: AudioContext;
    mediaStreamSource: MediaStreamAudioSourceNode;
    audioWorkletNode: AudioWorkletNode;
    mediaStream: MediaStream;
    isPaused: boolean;
    startStreaming(ws: any): Promise<void>;
    pause(): void;
    resume(): void;
    stop(): void;
}
