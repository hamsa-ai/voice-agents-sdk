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
     * @param {string} apiKey - API key for authentication.
     * @param {function} onRemoteStreamAvailable - Callback when remote MediaStream is available.
     * @param {function} onLocalStreamAvailable - Callback when local MediaStream is available.
     * @param {function} onInfo - Callback for info events.
     */
    constructor(url: string, conversationId: string, onError: Function, onStart: Function, onTranscriptionReceived: Function, onAnswerReceived: Function, onSpeaking: Function, onListening: Function, onClosed: Function, voiceEnablement: boolean, tools: any[], apiKey: string, onRemoteStreamAvailable: Function, onLocalStreamAvailable: Function, onInfo: Function);
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
    apiKey: string;
    onRemoteStreamAvailable: Function;
    onLocalStreamAvailable: Function;
    onInfoCB: Function;
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
     * Executes the provided tool functions, supporting both synchronous and asynchronous calls.
     *
     * This function iterates over the given array of tool objects. For each tool of type
     * "function", it attempts to locate the corresponding function by its name in the tools list.
     * The function arguments are parsed from a JSON string and passed to the function.
     * If the function executes successfully, its response is captured; otherwise, an error
     * message is returned. The results are returned in the same order as the input array.
     *
     * @param {Array} tools_array - An array of tool objects to execute. Each object should
     * have the following structure:
     *   {
     *     id: <unique identifier>,
     *     type: "function",
     *     function: {
     *       name: <string>,           // The function's name.
     *       arguments: <string>       // A JSON string representing the function arguments.
     *     }
     *   }
     * @returns {Promise<Array>} A promise that resolves to an array of results. Each result object has
     * the structure:
     *   {
     *     id: <tool id>,
     *     function: {
     *       name: <function name>,
     *       response: <result of the function call or an error message>
     *     }
     *   }
     */
    run_tools(tools_array: any[]): Promise<any[]>;
    #private;
}
import AudioPlayer from './audio_player';
import AudioRecorder from './audio_recorder';
