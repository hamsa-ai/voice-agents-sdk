import AudioPlayer from './audio_player';
import AudioRecorder from './audio_recorder';

export default class WebSocketManager {
    /**
     * Constructs a new WebSocketManager instance.
     * @param {string} url - The WebSocket URL.
     * @param {string} conversationId - The conversation ID.
     * @param {function} onError - Callback for error events.
     * @param {function} onStart - Callback when the WebSocket starts.
     * @param {function} onTranscriptionReceived - Callback for received transcriptions.
     * @param {function} onAnswerReceived - Callback for received answers.
     * @param {function} onSpeaking - Callback when speaking starts.
     * @param {function} onListening - Callback when listening starts.
     * @param {function} onClosed - Callback when the WebSocket is closed.
     * @param {boolean} voiceEnablement - Flag to enable voice features.
     * @param {Array} tools - Array of tools/functions to be used.
     * @param {string} voiceAgentId - Voice agent ID for authentication.
     * @param {function} onRemoteStreamAvailable - Callback when remote MediaStream is available.
     * @param {function} onLocalStreamAvailable - Callback when local MediaStream is available.
     */
    constructor(
        url, 
        conversationId,
        onError,
        onStart,
        onTranscriptionReceived,
        onAnswerReceived,
        onSpeaking,
        onListening,
        onClosed,
        voiceEnablement,
        tools,
        voiceAgentId,
        onRemoteStreamAvailable,
        onLocalStreamAvailable 
    ) {
        this.url = `${url}/${conversationId}?voice_agent_id=${voiceAgentId}`;
        this.ws = null;
        this.isConnected = false;
        this.audioPlayer = null;
        this.audioRecorder = null;
        this.last_transcription_date = new Date();
        this.last_voice_byte_date = new Date();
        this.is_media = false;
        this.onErrorCB = onError;
        this.onStartCB = onStart;
        this.onTranscriptionReceivedCB = onTranscriptionReceived;
        this.onAnswerReceivedCB = onAnswerReceived;
        this.onSpeakingCB = onSpeaking;
        this.onListeningCB = onListening;
        this.onClosedCB = onClosed;
        this.voiceEnablement = voiceEnablement;
        this.tools = tools;
        this.onRemoteStreamAvailable = onRemoteStreamAvailable;
        this.onLocalStreamAvailable = onLocalStreamAvailable;
        this.setVolume = this.setVolume.bind(this);
    }

    /**
     * Initializes and starts the WebSocket connection, AudioPlayer, and AudioRecorder.
     */
    startCall() {
        try {
            if (!this.ws) {
                // Initialize WebSocket connection
                this.ws = new WebSocket(this.url);

                // WebSocket event handlers
                this.ws.onopen = this.onOpen.bind(this);
                this.ws.onmessage = this.onMessage.bind(this);
                this.ws.onclose = this.onClose.bind(this);
                this.ws.onerror = this.onError.bind(this);

                // Initialize AudioPlayer with stream ready callback
                this.audioPlayer = new AudioPlayer(
                    this.ws, 
                    this.onSpeakingCB, 
                    this.onListeningCB, 
                    (remoteStream) => {
                        this.onRemoteStreamAvailable(remoteStream);
                    }
                );

                // Initialize AudioRecorder with stream ready callback
                this.audioRecorder = new AudioRecorder((localStream) => {
                    this.onLocalStreamAvailable(localStream);
                });

            }  
        } catch(e) {
            console.log(e);
            this.onErrorCB(e);
        }
    }

    /**
     * Handles the WebSocket 'open' event.
     */
    onOpen() {
        // Send a start event to notify server that streaming is starting
        if(this.ws){
            this.ws.send(JSON.stringify({ event: 'start', streamSid: 'WEBSDK' }));
        }
        this.isConnected = true;
        this.onStartCB(); // Emit start event

        // Start local audio streaming now that WebSocket is open
        if(this.audioRecorder){
            this.audioRecorder.startStreaming(this.ws).then(() => {
                // The local stream is already emitted via the callback
            }).catch((error) => {
                console.error('Failed to start AudioRecorder:', error);
                this.onErrorCB(error);
            });
        }
    }

    /**
     * Handles incoming WebSocket messages.
     * @param {MessageEvent} event - The message event.
     */
    onMessage(event) {
        try {
            const message = JSON.parse(event.data);
            if (!message.event) {
                throw new Error('Message does not contain event type.');
            }
            switch (message.event) {
                case 'media':
                    if (message.media) {
                        this.audioPlayer.enqueueAudio(message.media.payload);
                    }
                    break;
                case 'clear':
                    this.audioPlayer.stopAndClear();
                    break;
                case 'mark':
                    this.audioPlayer.addMark(message.mark.name);
                    break;
                case 'transcription':
                    if (this.onTranscriptionReceivedCB) this.onTranscriptionReceivedCB(message.content);
                    break;
                case 'answer':
                    if (this.onAnswerReceivedCB) this.onAnswerReceivedCB(message.content);
                    break;
                case 'tools':
                    const tools_response = this.run_tools(message.content);
                    this.ws.send(JSON.stringify({ event: 'tools_response', tools_response: tools_response,  streamSid: 'WEBSDK' }));
                    break;            
                default:
                    console.warn(`Unhandled event type: ${message.event}`);
                    break;
            }
        } catch (error) {
            console.error('Error handling message:', error);
            this.onErrorCB(error);
        }
    }

    /**
     * Handles the WebSocket 'close' event.
     * @param {CloseEvent} event - The close event.
     */
    onClose(event) {
        this.isConnected = false;
        this.onClosedCB(); // Emit closed event
        this.audioPlayer.stopAndClear();
        this.audioRecorder.stop();
        this.#closeWebSocket();
        this.ws = null
    }

    /**
     * Handles the WebSocket 'error' event.
     * @param {Event} error - The error event.
     */
    onError(error) {
        if (this.onErrorCB) this.onErrorCB(error);
    }

    /**
     * Ends the WebSocket call, stops AudioPlayer and AudioRecorder.
     */
    endCall() {
        try {
            if (this.audioPlayer) {
                this.audioPlayer.stopAndClear();
            }
            if (this.audioRecorder) {
                this.audioRecorder.stop();
            }
            if(this.ws){
                this.ws.send(JSON.stringify({ event: 'stop' }));
            }
            this.#closeWebSocket();
            this.isConnected = false;
            this.onClosedCB(); // Emit closed event
        } catch (e) {
            console.error('Error ending the call:', e);
            this.onErrorCB(e);
        }
    }

    /**
     * Pauses the WebSocket call by pausing AudioPlayer and AudioRecorder.
     */
    pauseCall() {
        try {
            if (this.audioPlayer) {
                this.audioPlayer.pause();
            }
            if (this.audioRecorder) {
                this.audioRecorder.pause();
            }
        } catch (e) {
            console.error('Error pausing the call:', e);
            this.onErrorCB(e);
        }
    }

    /**
     * Resumes the WebSocket call by resuming AudioPlayer and AudioRecorder.
     */
    resumeCall() {
        try {
            if (this.audioPlayer) {
                this.audioPlayer.resume();
            }
            if (this.audioRecorder) {
                this.audioRecorder.resume();
            }
        } catch (e) {
            console.error('Error resuming the call:', e);
            this.onErrorCB(e);
        }
    }

    /**
     * Sets the volume for AudioPlayer.
     * @param {number} volume - Volume level between 0.0 and 1.0.
     */
    setVolume(volume) {
        try {
            if (this.audioPlayer) {
                this.audioPlayer.setVolume(volume);
            }
        } catch (e) {
            console.error('Error setting volume:', e);
            this.onErrorCB(e);
        }
    }

    /**
     * Runs the tools based on the received tools array.
     * @param {Array} tools_array - Array of tool objects.
     * @returns {Array} Results after running the tools.
     */
    run_tools(tools_array) {
        const results = [];
        tools_array.forEach(item => {
            if (item.type === 'function') {
                const selected_function = this.#findFunctionByName(item.function.name)
                const functionName = item.function.name;
                const functionArgs = JSON.parse(item.function.arguments);
                if (selected_function && typeof selected_function["fn"] === 'function') {
                    const response = selected_function["fn"](...Object.values(functionArgs));
                    results.push({
                        id: item.id,
                        function: {
                            name: functionName,
                            response: response
                        }
                    });
                } else {
                    results.push({
                        id: item.id,
                        function: {
                            name: functionName,
                            response: "Error could not find the function"
                        }
                    });                    
                    console.log(`Function ${functionName} is not defined`);
                }
            }
        });
    
        return results;
    }

    /**
     * Finds a function by its name from the tools array.
     * @private
     * @param {string} functionName - The name of the function to find.
     * @returns {Object|null} The tool object if found, otherwise null.
     */
    #findFunctionByName(functionName) {
        return this.tools.find(item => item.function_name === functionName) || null;
    }

    /**
     * Closes the WebSocket connection gracefully.
     * @private
     */
    #closeWebSocket() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.close(1000, 'Normal Closure');
        }
    }            
}
