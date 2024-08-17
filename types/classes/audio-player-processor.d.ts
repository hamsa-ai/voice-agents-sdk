declare class AudioPlayerProcessor {
    audioData: any[];
    isPaused: boolean;
    marks: any[];
    clearAllData(): void;
    process(inputs: any, outputs: any): boolean;
}
