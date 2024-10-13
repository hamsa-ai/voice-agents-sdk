export class HamsaVoiceAgent extends EventEmitter<[never]> {
    constructor(apiKey: any);
    webSocketManager: WebSocketManager;
    apiKey: any;
    API_URL: string;
    WS_URL: string;
    setVolume(volume: any): void;
    start({ agentId, params, voiceEnablement, tools, }: {
        agentId?: any;
        params?: {};
        voiceEnablement?: boolean;
        tools?: any[];
    }): Promise<void>;
    end(): void;
    pause(): void;
    resume(): void;
    #private;
}
import { EventEmitter } from "events";
import WebSocketManager from "./classes/websocket_manager";
