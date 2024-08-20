export default class AudioPlayer {
    constructor(ws: any, onSpeaking: any, onListening: any);
    audioContext: any;
    ws: any;
    isPaused: boolean;
    onSpeakingCB: any;
    onListeningCB: any;
    isPlaying: boolean;
    initAudioWorklet(): Promise<void>;
    processor: AudioWorkletNode;
    enqueueAudio(base64Data: any): void;
    pause(): void;
    resume(): void;
    stopAndClear(): void;
    addMark(markName: any): void;
    pcm16ToFloat32(pcm16Array: any): Float32Array;
    updatePlayingState(isPlaying: any): void;
}
