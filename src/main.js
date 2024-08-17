import WebSocketManager from './classes/websocket_manager';
import { EventEmitter } from 'events';

export class HamsaVoiceAgent extends EventEmitter {
    constructor(apiKey) {
        super();
        this.webSocketManager = null;
        this.apiKey = apiKey;
        this.API_URL = "https://api.tryhamsa.com/api"
        this.WS_URL = "wss://bots-dev.tryhamsa.com/stream"
    }

    async start({
        agentId = null,
        params = {},
        voiceEnablement = false
    }) {
        try {
        const conversationdId = await this.#init_conversation(agentId, params);
        this.webSocketManager = new WebSocketManager(
            this.WS_URL,
            conversationdId,
            (error) => this.emit('error', error),
            () => this.emit('start'),
            (transcription) => this.emit('transcriptionReceived', transcription),
            (answer) => this.emit('answerReceived', answer),
            () => this.emit('speaking'),
            () => this.emit('listening'),
            () => this.emit('closed'),
            voiceEnablement,
            this.apiKey
        );
        this.webSocketManager.startCall();
        this.emit('callStarted');
        } catch (e) {
            this.emit('error', new Error("Error in starting the call! Make sure you initialized the client with init()."));
        }
    }

    end() {
        try {
            this.webSocketManager.endCall();
            this.emit('callEnded');
        } catch (e) {
            this.emit('error', new Error("Error in ending the call! Make sure you initialized the client with init()."));
        }
    }

    pause() {
        this.webSocketManager.pauseCall();
        this.emit('callPaused');
    }

    resume() {
        this.webSocketManager.resumeCall();
        this.emit('callResumed');
    }
    
    async #init_conversation(voiceAgentId, params) {
        const headers = {
            "Authorization": `Token ${this.apiKey}`,
            "Content-Type": "application/json"
        }
        const body = {
            voiceAgentId,
            params
        }

        const requestOptions = {
            method: "POST",
            headers: headers,
            body: JSON.stringify(body),
            redirect: "follow"
          };
          
          try {
            const response = await fetch(`${this.API_URL}/v1/voice-agents/conversation-init`, requestOptions);
            const result = await response.json();
            return result["data"]["jobId"]
          } catch (error) {
            this.emit('error', new Error("Error in initializing the call, Double check your API_KEY"));
          };
    }
}

