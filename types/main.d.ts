export class HamsaVoiceAgent extends EventEmitter<[never]> {
    constructor(apiKey: any);
    webSocketManager: WebSocketManager;
    apiKey: any;
    API_URL: string;
    WS_URL: string;
    setVolume(volume: any): void;
    start({ agentId, params, voiceEnablement, tools }?: {
        agentId?: any;
        params?: {};
        voiceEnablement?: boolean;
        tools?: any[];
    }): Promise<void>;
    jobId: any;
    end(): void;
    pause(): void;
    resume(): void;
    /**
     * Retrieves job details from the Hamsa API using the stored jobId.
     * Implements retry logic with exponential backoff.
     * @param {number} [maxRetries=5] - Maximum number of retry attempts.
     * @param {number} [initialRetryInterval=1000] - Initial delay between retries in milliseconds.
     * @param {number} [backoffFactor=2] - Factor by which the retry interval increases each attempt.
     * @returns {Promise<Object>} Job details object.
     */
    getJobDetails(maxRetries?: number, initialRetryInterval?: number, backoffFactor?: number): Promise<any>;
    #private;
}
import { EventEmitter } from 'events';
import WebSocketManager from './classes/websocket_manager';
