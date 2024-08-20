declare class AudioPlayerProcessor {
    audioData: any[];
    isPaused: boolean;
    marks: any[];
    isDone: boolean;
    clearAllData(): void;
    process(inputs: any, outputs: any): boolean;
}
