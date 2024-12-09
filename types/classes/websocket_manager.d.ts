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
    constructor(url: string, conversationId: string, onError: Function, onStart: Function, onTranscriptionReceived: Function, onAnswerReceived: Function, onSpeaking: Function, onListening: Function, onClosed: Function, voiceEnablement: boolean, tools: any[], voiceAgentId: string, onRemoteStreamAvailable: Function, onLocalStreamAvailable: Function);
    url: string;
    ws: WebSocket;
    isConnected: boolean;
    audioPlayer: AudioPlayer;
    audioRecorder: AudioRecorder;
    last_transcription_date: Date;
    last_voice_byte_date: Date;
    is_media: boolean;
    onErrorCB: Function;
    onStartCB: Function;
    onTranscriptionReceivedCB: Function;
    onAnswerReceivedCB: Function;
    onSpeakingCB: Function;
    onListeningCB: Function;
    onClosedCB: Function;
    voiceEnablement: boolean;
    tools: any[];
    onRemoteStreamAvailable: Function;
    onLocalStreamAvailable: Function;
    /**
     * Sets the volume for AudioPlayer.
     * @param {number} volume - Volume level between 0.0 and 1.0.
     */
    setVolume(volume: number): void;
    /**
     * Initializes and starts the WebSocket connection, AudioPlayer, and AudioRecorder.
     */
    startCall(): void;
    /**
     * Handles the WebSocket 'open' event.
     */
    onOpen(): void;
    /**
     * Handles incoming WebSocket messages.
     * @param {MessageEvent} event - The message event.
     */
    onMessage(event: MessageEvent): void;
    /**
     * Handles the WebSocket 'close' event.
     * @param {CloseEvent} event - The close event.
     */
    onClose(event: CloseEvent): void;
    /**
     * Handles the WebSocket 'error' event.
     * @param {Event} error - The error event.
     */
    onError(error: Event): void;
    /**
     * Ends the WebSocket call, stops AudioPlayer and AudioRecorder.
     */
    endCall(): void;
    /**
     * Pauses the WebSocket call by pausing AudioPlayer and AudioRecorder.
     */
    pauseCall(): void;
    /**
     * Resumes the WebSocket call by resuming AudioPlayer and AudioRecorder.
     */
    resumeCall(): void;
    /**
     * Runs the tools based on the received tools array.
     * @param {Array} tools_array - Array of tool objects.
     * @returns {Array} Results after running the tools.
     */
    run_tools(tools_array: any[]): any[];
    #private;
}
import AudioPlayer from './audio_player';
import AudioRecorder from './audio_recorder';
