export default HamsaVoiceAgent;
export class HamsaVoiceAgent extends EventEmitter<[never]> {
    /**
     * Creates a new HamsaVoiceAgent instance.
     *
     * @param {string} apiKey - API key.
     * @param {object} [config] - Optional config.
     * @param {string} [config.API_URL="https://api.tryhamsa.com"] - API URL.
     * @param {string} [config.WS_URL="wss://bots.tryhamsa.com/stream"] - WebSocket URL.
     */
    constructor(apiKey: string, { API_URL, WS_URL, }?: {
        API_URL?: string;
        WS_URL?: string;
    });
    webSocketManager: WebSocketManager;
    apiKey: string;
    API_URL: string;
    WS_URL: string;
    jobId: string;
    wakeLockManager: ScreenWakeLock;
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
import ScreenWakeLock from "./classes/screen_wake_lock";
