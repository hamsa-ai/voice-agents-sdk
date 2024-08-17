export default class FancyButton {
    constructor(voiceEnablement: any);
    isCallStarted: boolean;
    iframe: HTMLIFrameElement;
    isIframeLoaded: boolean;
    voiceEnablement: any;
    createFloatingButton(WSManager: any): void;
    WSManager: any;
    toggleCall(): void;
    startCall(): void;
    endCall(): void;
    updateButtonAppearance(): void;
    startWaveAnimation(): void;
    stopWaveAnimation(): void;
    createIframe(callback: any): void;
    removeIframe(): void;
}
