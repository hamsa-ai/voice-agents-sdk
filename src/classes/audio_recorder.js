export default class AudioRecorder {
    constructor() {
        this.audioContext = null;
        this.mediaStreamSource = null;
        this.processor = null;
    }

    async startStreaming(ws) {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: false
        });
        this.audioContext = new AudioContext({ sampleRate: 16000 });
        this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
        this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
        this.mediaStreamSource.connect(this.processor);
        this.processor.connect(this.audioContext.destination);

        this.processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const data_to_send = new Float32Array(inputData).buffer;
            this.processAudioData(data_to_send, ws);
        };
    }

    processAudioData(rawAudioData, ws) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            const base64String = btoa(String.fromCharCode(...new Uint8Array(rawAudioData)));
            ws.send(JSON.stringify({ event: 'media', streamSid: 'stream1', media: { payload: base64String } }));
        }
    }
}
