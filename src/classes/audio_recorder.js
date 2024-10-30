import AudioProcessor from './audio-processor.worklet.js';

export default class AudioRecorder {
    /**
     * Constructs a new AudioRecorder instance.
     * @param {function} onStreamReady - Callback invoked when MediaStream is ready.
     */
    constructor(onStreamReady) {
        this.audioContext = null;
        this.mediaStreamSource = null;
        this.audioWorkletNode = null;
        this.mediaStream = null; 
        this.isPaused = false;
        this.mediaStreamDestination = null;
        this.onStreamReady = onStreamReady;
    }

    /**
     * Starts streaming audio by capturing from the microphone and sending it over WebSocket.
     * @param {WebSocket} ws - The WebSocket connection.
     * @returns {Promise<void>}
     */
    async startStreaming(ws) {
        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: false
                },
                video: false
            });
            
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
                
            await this.audioContext.audioWorklet.addModule(AudioProcessor);
            this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');
    
            // Create MediaStreamDestination to expose the local audio
            this.mediaStreamDestination = this.audioContext.createMediaStreamDestination();
            
            // Connect the audio worklet node to both destination and MediaStreamDestination
            this.audioWorkletNode.connect(this.audioContext.destination); // Sends audio to speakers
            this.audioWorkletNode.connect(this.mediaStreamDestination); // Exposes MediaStream for local visualization
    
            // Connect the media stream source to the AudioWorkletNode
            this.mediaStreamSource.connect(this.audioWorkletNode);
    
            // Handle messages from the AudioWorkletProcessor
            this.audioWorkletNode.port.onmessage = (event) => {
                if (this.isPaused) return; // Pause processing if needed
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(event.data));
                }
            };
    
            // Notify that the MediaStream is ready
            if (this.onStreamReady) {
                this.onStreamReady(this.getMediaStream());
            }
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

    /**
     * Pauses audio streaming.
     */
    pause() {
        this.isPaused = true; 
    }

    /**
     * Resumes audio streaming.
     */
    resume() {
        this.isPaused = false;
    }

    /**
     * Stops audio streaming and releases resources.
     */
    stop() {
        // Stop the media stream tracks to release the microphone
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }

        // Disconnect the MediaStreamDestination
        if (this.mediaStreamDestination) {
            this.mediaStreamDestination.disconnect();
            this.mediaStreamDestination = null;
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

    /**
     * Returns the MediaStream capturing the local audio being recorded.
     * @returns {MediaStream | null}
     */
    getMediaStream() {
        return this.mediaStreamDestination ? this.mediaStreamDestination.stream : null;
    }
}