export class HamsaVoiceAgent extends EventEmitter<[never]> {
    constructor(apiKey: any);
    webSocketManager: WebSocketManager;
    apiKey: any;
    API_URL: string;
    WS_URL: string;
    start({ agentId, params, voiceEnablement }: {
        agentId?: any;
        params?: {};
        voiceEnablement?: boolean;
    }): Promise<void>;
    end(): void;
    pause(): void;
    resume(): void;
    #private;
}
import { EventEmitter } from 'events';
import WebSocketManager from './classes/websocket_manager';
