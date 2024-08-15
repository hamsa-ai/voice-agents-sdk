export default class AudioRecorder {
    constructor() {
        this.audioContext = null;
        this.mediaStreamSource = null;
        this.audioWorkletNode = null;
        this.mediaStream = null; 
        this.isPaused = false;
    }

    async startStreaming(ws) {
        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: false
            });
            
            this.audioContext = new AudioContext({ sampleRate: 16000 });
                
            try {
                await this.audioContext.audioWorklet.addModule(new URL('./audio-processor.js', import.meta.url));
                console.log('AudioWorklet module loaded successfully');
            } catch (e) {
                console.error('Failed to load AudioWorklet module', e);
            }

            this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');
    
            // Connect the media stream source to the AudioWorkletNode
            this.mediaStreamSource.connect(this.audioWorkletNode);
            this.audioWorkletNode.connect(this.audioContext.destination);
    
            // Handle messages from the AudioWorkletProcessor
            this.audioWorkletNode.port.onmessage = (event) => {
                if (this.isPaused) return; // Pause processing if needed
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(event.data));
                }
            };
        } catch (error) {
            if (error.name === 'NotAllowedError') {
                console.error("Microphone access denied by the user.", error);
                alert("Microphone access was denied. Please allow access to use the audio features.");
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                console.error("No microphone device found.", error);
                alert("No microphone was found on this device.");
            } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                console.error("Microphone is already in use by another application.", error);
                alert("The microphone is currently in use by another application.");
            } else if (error.name === 'AbortError') {
                console.error("The user aborted the request.", error);
                alert("Microphone access request was aborted. Please try again.");
            } else {
                console.error("Error accessing the microphone: ", error);
                alert("An unknown error occurred while trying to access the microphone.");
            }
        }
    }

    pause() {
        this.isPaused = true; 
    }

    resume() {
        this.isPaused = false;
    }

    stop() {
        // Stop the media stream tracks to release the microphone
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }

        // Disconnect the audio processing nodes and close the audio context
        if (this.audioWorkletNode) {
            this.audioWorkletNode.disconnect();
        }

        if (this.mediaStreamSource) {
            this.mediaStreamSource.disconnect();
        }

        if (this.audioContext) {
            this.audioContext.close();
        }

        // Reset variables to their initial state
        this.audioContext = null;
        this.mediaStreamSource = null;
        this.audioWorkletNode = null;
        this.mediaStream = null;
        this.isPaused = false;
    }
}
