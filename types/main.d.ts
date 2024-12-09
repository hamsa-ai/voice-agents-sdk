export class HamsaVoiceAgent extends EventEmitter<[never]> {
    constructor(voiceAgentId?: any);
    webSocketManager: WebSocketManager;
    voiceAgentId: any;
    API_URL: string;
    WS_URL: string;
    jobId: string;
    /**
     * Sets the volume for the audio playback.
     * @param {number} volume - Volume level between 0.0 and 1.0.
     */
    setVolume(volume: number): void;
    /**
     * Starts a new voice agent call.
     * @param {object} options - Configuration options for the call.
     */
    start({ agentId, params, voiceEnablement, tools }: object): Promise<void>;
    /**
     * Ends the current voice agent call.
     */
    end(): void;
    /**
     * Pauses the current voice agent call.
     */
    pause(): void;
    /**
     * Resumes the paused voice agent call.
     */
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
