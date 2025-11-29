/**
 * LiveKitManager - Main orchestrator for voice agent communication
 *
 * This class serves as the primary interface for managing real-time voice communication
 * with AI agents using LiveKit WebRTC infrastructure. It coordinates four specialized
 * modules to provide a comprehensive voice agent SDK:
 *
 * - Connection Management: Handles room connections, participants, and network state
 * - Analytics Engine: Processes WebRTC statistics and performance metrics
 * - Audio Management: Manages audio tracks, volume control, and quality monitoring
 * - Tool Registry: Handles RPC method registration and client-side tool execution
 *
 * Key features:
 * - Real-time audio streaming with automatic quality adjustment
 * - Comprehensive analytics and monitoring capabilities
 * - Client-side tool integration for extended agent functionality
 * - Automatic reconnection and error recovery
 * - Event-driven architecture for reactive applications
 *
 * @example
 * ```typescript
 * const manager = new LiveKitManager(
 *   'wss://livekit.example.com',
 *   'access_token',
 *   [customTool1, customTool2]
 * );
 *
 * manager.on('connected', () => console.log('Connected to voice agent'));
 * manager.on('answerReceived', (text) => console.log('Agent said:', text));
 *
 * await manager.connect();
 * ```
 */
import { EventEmitter } from 'events';
import type { Room } from 'livekit-client';
import { type DebugLogger } from '../utils';
import { LiveKitAnalytics } from './livekit-analytics';
import { LiveKitAudioManager } from './livekit-audio-manager';
import { LiveKitConnection } from './livekit-connection';
import { LiveKitToolRegistry } from './livekit-tool-registry';
import type { AudioLevelsResult, CallAnalyticsResult, ConnectionStatsResult, ParticipantData, PerformanceMetricsResult, Tool, TrackStatsResult } from './types';
export type { AgentState, AudioLevelsResult, CallAnalyticsResult, ConnectionStatsResult, ParticipantData, PerformanceMetricsResult, TrackStatsData, TrackStatsResult, } from './types';
/**
 * Main LiveKitManager class that orchestrates voice agent communication
 *
 * This class extends EventEmitter to provide a reactive interface for handling
 * voice agent interactions, real-time analytics, and WebRTC connection management.
 */
export default class LiveKitManager extends EventEmitter {
    #private;
    /** Connection module - manages LiveKit room connections and participants */
    connection: LiveKitConnection;
    /** Analytics module - processes WebRTC stats and performance metrics */
    analytics: LiveKitAnalytics;
    /** Audio module - manages audio tracks, volume, and quality */
    audioManager: LiveKitAudioManager;
    /** Tool registry - handles client-side tool registration and RPC calls */
    toolRegistry: LiveKitToolRegistry;
    /** LiveKit WebSocket URL for room connection */
    lkUrl: string;
    /** JWT access token for authentication */
    accessToken: string;
    /** Debug logger instance for conditional logging */
    logger: DebugLogger;
    /**
     * Creates a new LiveKitManager instance
     *
     * @param lkUrl - LiveKit WebSocket URL (e.g., 'wss://your-livekit.example.com')
     * @param accessToken - JWT token for room access authentication
     * @param tools - Array of client-side tools that agents can call during conversations
     *
     * @example
     * ```typescript
     * const customTool = {
     *   function_name: "getUserData",
     *   description: "Retrieves user information",
     *   parameters: [{ name: "userId", type: "string", description: "User ID" }],
     *   required: ["userId"],
     *   fn: async (userId: string) => ({ name: "John", email: "john@example.com" })
     * };
     *
     * const manager = new LiveKitManager(
     *   'wss://livekit.example.com',
     *   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
     *   [customTool]
     * );
     * ```
     */
    constructor(lkUrl: string, accessToken: string, tools?: Tool[], debug?: boolean);
    /**
     * Establishes connection to the LiveKit room and initializes voice agent communication
     *
     * This method performs the following operations:
     * - Validates connection state to prevent duplicate connections
     * - Updates analytics tracking for connection attempts
     * - Establishes WebRTC connection to the LiveKit room
     * - Triggers module initialization once connected
     *
     * @throws {Error} Connection errors from LiveKit (network issues, authentication failures, etc.)
     *
     * @example
     * ```typescript
     * try {
     *   await manager.connect();
     *   console.log('Successfully connected to voice agent');
     * } catch (error) {
     *   console.error('Failed to connect:', error.message);
     * }
     * ```
     */
    connect(): Promise<void>;
    /**
     * Terminates the connection to the LiveKit room and performs cleanup
     *
     * This method safely disconnects from the voice agent and ensures all resources
     * are properly released, including audio tracks, analytics timers, and event listeners.
     *
     * @example
     * ```typescript
     * await manager.disconnect();
     * console.log('Disconnected from voice agent');
     * ```
     */
    disconnect(): Promise<void>;
    /**
     * Pauses the voice conversation, stopping audio transmission and reception
     *
     * This temporarily halts communication with the voice agent while maintaining
     * the underlying connection. Audio playback is paused and microphone input
     * is muted until resume() is called.
     *
     * @example
     * ```typescript
     * manager.pause();
     * console.log('Conversation paused');
     *
     * // Resume later
     * setTimeout(() => manager.resume(), 5000);
     * ```
     */
    pause(): void;
    /**
     * Resumes a paused voice conversation
     *
     * Restores audio transmission and reception, allowing continued communication
     * with the voice agent. This reverses the effects of pause().
     *
     * @example
     * ```typescript
     * manager.resume();
     * console.log('Conversation resumed');
     * ```
     */
    resume(): void;
    /**
     * Adjusts the volume level for audio playback from the voice agent
     *
     * @param volume - Volume level between 0.0 (muted) and 1.0 (full volume)
     *
     * @example
     * ```typescript
     * // Set to half volume
     * manager.setVolume(0.5);
     *
     * // Mute completely
     * manager.setVolume(0);
     *
     * // Full volume
     * manager.setVolume(1.0);
     * ```
     */
    setVolume(volume: number): void;
    /**
     * Gets the current LiveKit room instance
     *
     * @returns The LiveKit Room object if connected, null otherwise
     *
     * @example
     * ```typescript
     * const room = manager.room;
     * if (room) {
     *   console.log('Connected to room:', room.name);
     *   console.log('Participants:', room.remoteParticipants.size);
     * }
     * ```
     */
    get room(): Room | null;
    /**
     * Checks if currently connected to the voice agent
     *
     * @returns True if connected to LiveKit room, false otherwise
     *
     * @example
     * ```typescript
     * if (manager.isConnected) {
     *   console.log('Ready for voice communication');
     * } else {
     *   console.log('Not connected - call connect() first');
     * }
     * ```
     */
    get isConnected(): boolean;
    /**
     * Checks if the conversation is currently paused
     *
     * @returns True if paused, false if active or disconnected
     *
     * @example
     * ```typescript
     * if (manager.isPaused) {
     *   console.log('Conversation is paused');
     *   showResumeButton();
     * }
     * ```
     */
    get isPaused(): boolean;
    /**
     * Gets the current audio volume level
     *
     * @returns Current volume between 0.0 (muted) and 1.0 (full volume)
     *
     * @example
     * ```typescript
     * const currentVolume = manager.volume;
     * updateVolumeSlider(currentVolume);
     * ```
     */
    get volume(): number;
    /**
     * Gets the set of active HTML audio elements
     *
     * @returns Set of HTMLAudioElement instances currently playing agent audio
     *
     * @example
     * ```typescript
     * const audioElements = manager.audioElements;
     * console.log(`Active audio elements: ${audioElements.size}`);
     * ```
     */
    get audioElements(): Set<HTMLAudioElement>;
    /**
     * Gets the array of registered client-side tools
     *
     * @returns Array of Tool objects available for agent execution
     *
     * @example
     * ```typescript
     * const registeredTools = manager.tools;
     * console.log(`Available tools: ${registeredTools.map(t => t.function_name).join(', ')}`);
     * ```
     */
    get tools(): Tool[];
    /**
     * Gets raw call statistics from the analytics module
     *
     * @returns Internal call statistics object with WebRTC metrics
     * @internal
     */
    get callStats(): import("./types").CallStats;
    /**
     * Gets raw connection metrics from the analytics module
     *
     * @returns Internal connection metrics object
     * @internal
     */
    get connectionMetrics(): import("./types").ConnectionMetrics;
    /**
     * Gets raw audio metrics from the analytics module
     *
     * @returns Internal audio metrics object
     * @internal
     */
    get audioMetrics(): import("./types").AudioMetrics;
    /**
     * Gets raw performance metrics from the analytics module
     *
     * @returns Internal performance metrics object
     * @internal
     */
    get performanceMetrics(): import("./types").PerformanceMetrics;
    /**
     * Gets the analytics collection interval timer
     *
     * @returns NodeJS.Timeout for the analytics interval, or null if not collecting
     * @internal
     */
    get analyticsInterval(): NodeJS.Timeout | null;
    /**
     * Gets the timestamp when the call started
     *
     * @returns Unix timestamp in milliseconds when call began, null if not started
     *
     * @example
     * ```typescript
     * const startTime = manager.callStartTime;
     * if (startTime) {
     *   const duration = Date.now() - startTime;
     *   console.log(`Call duration: ${Math.floor(duration / 1000)}s`);
     * }
     * ```
     */
    get callStartTime(): number | null;
    /**
     * Gets the map of active participants in the room
     *
     * @returns Map of participant SIDs to Participant objects
     * @internal Use getParticipants() for structured participant data
     */
    get participants(): Map<string, ParticipantData>;
    /**
     * Gets the raw track statistics map
     *
     * @returns Map of track IDs to track data objects
     * @internal Use getTrackStats() for structured track statistics
     */
    get trackStats(): Map<string, import("./types").TrackStatsData>;
    /**
     * Retrieves current network connection statistics and quality metrics
     *
     * @returns Object containing connection quality, connection counts, and timing data
     *
     * @example
     * ```typescript
     * const stats = manager.getConnectionStats();
     * console.log(`Connection quality: ${stats.quality}`);
     * console.log(`Connection attempts: ${stats.connectionAttempts}`);
     * console.log(`Reconnections: ${stats.reconnectionAttempts}`);
     *
     * if (stats.quality === 'poor') {
     *   showNetworkWarning();
     * }
     * ```
     */
    getConnectionStats(): ConnectionStatsResult;
    /**
     * Retrieves current audio levels and quality metrics for both user and agent
     *
     * @returns Object containing audio levels, speaking times, quality metrics, pause state, and volume
     *
     * @example
     * ```typescript
     * const audio = manager.getAudioLevels();
     *
     * // Update audio level indicators in UI
     * updateMeterBar('user-audio', audio.userAudioLevel);
     * updateMeterBar('agent-audio', audio.agentAudioLevel);
     *
     * // Show speaking time statistics
     * console.log(`User spoke for ${audio.userSpeakingTime / 1000}s`);
     * console.log(`Agent spoke for ${audio.agentSpeakingTime / 1000}s`);
     * ```
     */
    getAudioLevels(): AudioLevelsResult & {
        isPaused: boolean;
        volume: number;
    };
    /**
     * Retrieves current performance metrics including response times and call duration
     *
     * @returns Object containing response times, call duration, and connection timing
     *
     * @example
     * ```typescript
     * const perf = manager.getPerformanceMetrics();
     *
     * // Monitor response time for agent interactions
     * if (perf.responseTime > 3000) {
     *   console.warn('High response time detected:', perf.responseTime + 'ms');
     * }
     *
     * // Display call duration
     * const minutes = Math.floor(perf.callDuration / 60000);
     * const seconds = Math.floor((perf.callDuration % 60000) / 1000);
     * console.log(`Call duration: ${minutes}:${seconds.toString().padStart(2, '0')}`);
     * ```
     */
    getPerformanceMetrics(): PerformanceMetricsResult;
    /**
     * Retrieves structured information about all participants in the room
     *
     * @returns Array of ParticipantData objects with identity, connection info, and metadata
     *
     * @example
     * ```typescript
     * const participants = manager.getParticipants();
     *
     * participants.forEach(participant => {
     *   console.log(`Participant: ${participant.identity}`);
     *   console.log(`Connected at: ${new Date(participant.connectionTime)}`);
     *
     *   if (participant.metadata) {
     *     console.log(`Metadata: ${participant.metadata}`);
     *   }
     * });
     *
     * // Find the agent participant
     * const agent = participants.find(p => p.identity.includes('agent'));
     * ```
     */
    getParticipants(): ParticipantData[];
    /**
     * Retrieves current audio track statistics and stream information
     *
     * @returns Object containing track counts, audio element info, and detailed track data
     *
     * @example
     * ```typescript
     * const trackStats = manager.getTrackStats();
     *
     * console.log(`Active tracks: ${trackStats.activeTracks}/${trackStats.totalTracks}`);
     * console.log(`Audio elements: ${trackStats.audioElements}`);
     *
     * // Inspect individual tracks
     * trackStats.trackDetails.forEach(([trackId, data]) => {
     *   console.log(`Track ${trackId}: ${data.kind} from ${data.participant}`);
     * });
     * ```
     */
    getTrackStats(): TrackStatsResult;
    /**
     * Retrieves comprehensive analytics combining all metrics into a single snapshot
     *
     * This is the primary method for accessing complete call analytics, combining
     * connection statistics, audio metrics, performance data, participant info,
     * track statistics, and call metadata into a unified result.
     *
     * @returns Complete analytics object with all available metrics and metadata
     *
     * @example
     * ```typescript
     * const analytics = manager.getCallAnalytics();
     *
     * // Log comprehensive call summary
     * console.log('=== Call Analytics ===');
     * console.log(`Duration: ${analytics.performanceMetrics.callDuration}ms`);
     * console.log(`Quality: ${analytics.connectionStats.quality}`);
     * console.log(`Participants: ${analytics.participants.length}`);
     * console.log(`Tracks: ${analytics.trackStats.activeTracks}`);
     *
     * // Send to analytics service
     * analyticsService.recordCall({
     *   sessionId: generateSessionId(),
     *   timestamp: Date.now(),
     *   data: analytics
     * });
     *
     * // Check for quality issues
     * if (analytics.connectionStats.quality === 'poor') {
     *   reportNetworkIssue(analytics.connectionStats);
     * }
     * ```
     */
    getCallAnalytics(): CallAnalyticsResult;
    /**
     * Registers client-side tools that voice agents can call during conversations
     *
     * This method updates the available tools and registers them as RPC methods
     * with the LiveKit room for remote execution by voice agents.
     *
     * @param tools - Optional array of Tool objects to register. If not provided,
     *                uses tools from constructor or previously set tools.
     *
     * @example
     * ```typescript
     * const userDataTool = {
     *   function_name: "getUserProfile",
     *   description: "Retrieves user profile information",
     *   parameters: [
     *     { name: "userId", type: "string", description: "User ID to lookup" }
     *   ],
     *   required: ["userId"],
     *   fn: async (userId: string) => {
     *     const user = await userService.getProfile(userId);
     *     return { name: user.name, email: user.email, plan: user.subscription };
     *   }
     * };
     *
     * const weatherTool = {
     *   function_name: "getCurrentWeather",
     *   description: "Gets current weather for a location",
     *   parameters: [
     *     { name: "location", type: "string", description: "City name" }
     *   ],
     *   required: ["location"],
     *   fn: async (location: string) => {
     *     return await weatherAPI.getCurrent(location);
     *   }
     * };
     *
     * // Register new tools after connection
     * manager.registerTools([userDataTool, weatherTool]);
     *
     * // Agent can now call these tools during conversation
     * manager.on('answerReceived', (text) => {
     *   console.log('Agent response:', text);
     *   // Agent might say: "I found your profile! You're on the premium plan."
     * });
     * ```
     */
    registerTools(tools?: Tool[]): void;
    /**
     * Performs comprehensive cleanup of all modules and resources
     *
     * This method ensures all resources are properly released, including:
     * - WebRTC connections and media streams
     * - Audio elements and playback resources
     * - Analytics timers and event listeners
     * - Tool registry and RPC handlers
     *
     * Called automatically on disconnect, but can be called manually for
     * explicit resource management in complex applications.
     *
     * @example
     * ```typescript
     * // Explicit cleanup when component unmounts
     * useEffect(() => {
     *   return () => {
     *     manager.cleanup();
     *   };
     * }, []);
     *
     * // Cleanup before reconnecting with different configuration
     * await manager.disconnect();
     * manager.cleanup();
     *
     * const newManager = new LiveKitManager(newUrl, newToken, newTools);
     * ```
     */
    cleanup(): void;
}
