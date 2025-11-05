/**
 * LiveKitConnection - WebRTC connection management for voice agent communication
 *
 * This class manages the core WebRTC connection to LiveKit rooms, handling connection
 * lifecycle, participant management, and real-time communication state. It serves as
 * the foundation for voice agent interactions by providing reliable, scalable WebRTC
 * connectivity with automatic reconnection and comprehensive event handling.
 *
 * Key Features:
 * - **Robust Connection Management**: Automatic connection establishment, monitoring, and cleanup
 * - **Intelligent Reconnection**: Built-in reconnection logic with attempt tracking
 * - **Participant Tracking**: Real-time monitoring of room participants and their metadata
 * - **Connection Quality Optimization**: Adaptive streaming and bandwidth management
 * - **Pause/Resume Functionality**: Microphone control for conversation flow management
 * - **Comprehensive Event System**: Detailed events for connection state changes
 * - **Performance Monitoring**: Connection timing and attempt statistics
 *
 * Connection Lifecycle:
 * 1. **Initialization**: Room setup with optimized WebRTC configuration
 * 2. **Connection**: Secure connection establishment with performance tracking
 * 3. **Monitoring**: Real-time connection quality and participant management
 * 4. **Reconnection**: Automatic recovery from network issues
 * 5. **Cleanup**: Proper resource disposal and state management
 *
 * WebRTC Configuration:
 * - Adaptive streaming for optimal bandwidth usage
 * - Dynacast for efficient bandwidth management
 * - HD video capability (720p) for future video features
 * - Automatic echo cancellation and noise suppression
 *
 * @example Basic Connection Management
 * ```typescript
 * const connection = new LiveKitConnection(
 *   'wss://livekit.example.com',
 *   'jwt_access_token_here'
 * );
 *
 * // Set up event listeners
 * connection.on('connected', () => {
 *   console.log('Connected to voice agent room');
 *   enableVoiceInterface();
 * });
 *
 * connection.on('disconnected', () => {
 *   console.log('Disconnected from room');
 *   disableVoiceInterface();
 * });
 *
 * connection.on('reconnecting', () => {
 *   showReconnectingIndicator();
 * });
 *
 * // Connect to room
 * await connection.connect();
 * ```
 *
 * @example Participant Management
 * ```typescript
 * connection.on('participantConnected', (participant) => {
 *   console.log(`${participant.identity} joined the conversation`);
 *
 *   if (participant.identity.includes('agent')) {
 *     showAgentStatus('online');
 *     enableAgentFeatures();
 *   }
 * });
 *
 * connection.on('participantDisconnected', (participant) => {
 *   console.log(`${participant.identity} left the conversation`);
 *
 *   if (participant.identity.includes('agent')) {
 *     showAgentStatus('offline');
 *     handleAgentDisconnection();
 *   }
 * });
 *
 * // Get current participants
 * const participants = connection.getParticipants();
 * const agentPresent = participants.some(p => p.identity.includes('agent'));
 * ```
 *
 * @example Connection Quality Monitoring
 * ```typescript
 * connection.on('connectionStateChanged', (state) => {
 *   switch (state) {
 *     case 'connected':
 *       hideConnectionWarnings();
 *       break;
 *     case 'reconnecting':
 *       showConnectionIssueWarning();
 *       break;
 *     case 'disconnected':
 *       showConnectionLostError();
 *       break;
 *   }
 * });
 *
 * // Monitor connection statistics
 * const stats = connection.getConnectionStats();
 * console.log(`Connection attempts: ${stats.connectionAttempts}`);
 * console.log(`Reconnection attempts: ${stats.reconnectionAttempts}`);
 * console.log(`Participants: ${stats.participantCount}`);
 * ```
 *
 * @example Pause/Resume Functionality
 * ```typescript
 * // Pause conversation (mute microphone)
 * pauseButton.addEventListener('click', () => {
 *   connection.pause();
 *   showPausedIndicator();
 * });
 *
 * // Resume conversation (unmute microphone)
 * resumeButton.addEventListener('click', () => {
 *   connection.resume();
 *   hidePausedIndicator();
 * });
 *
 * // Listen for pause/resume events
 * connection.on('connectionPaused', () => {
 *   updateUIForPausedState();
 * });
 *
 * connection.on('connectionResumed', () => {
 *   updateUIForActiveState();
 * });
 * ```
 *
 * @example Error Handling
 * ```typescript
 * connection.on('connectionError', (error) => {
 *   console.error('Connection error:', error.message);
 *
 *   // Implement retry logic
 *   if (error.message.includes('authentication')) {
 *     handleAuthenticationError();
 *   } else if (error.message.includes('network')) {
 *     handleNetworkError();
 *     // Automatic reconnection will be attempted
 *   }
 * });
 *
 * // Monitor reconnection attempts
 * connection.on('reconnecting', () => {
 *   const attempts = connection.getReconnectionAttempts();
 *   if (attempts > 3) {
 *     suggestNetworkTroubleshooting();
 *   }
 * });
 * ```
 *
 * Technical Implementation:
 * - Built on LiveKit's v2.15.4 WebRTC infrastructure
 * - Supports adaptive streaming for bandwidth optimization
 * - Implements connection pre-warming for faster establishment
 * - Provides comprehensive event forwarding from LiveKit room events
 * - Maintains participant metadata and connection timing information
 * - Includes fallback mechanisms for connection reliability
 */
import { EventEmitter } from 'events';
import { Room } from 'livekit-client';
import type { ParticipantData } from './types';
/**
 * LiveKitConnection class for managing WebRTC connections to voice agent rooms
 *
 * Extends EventEmitter to provide real-time connection status updates and
 * participant management events for voice agent applications.
 */
export declare class LiveKitConnection extends EventEmitter {
    #private;
    /** LiveKit room instance for WebRTC communication */
    room: Room | null;
    /** Current connection status to the LiveKit room */
    isConnected: boolean;
    /** Whether the conversation is currently paused (microphone muted) */
    isPaused: boolean;
    /** Map of active participants in the room with their metadata */
    participants: Map<string, ParticipantData>;
    /** Unix timestamp when the connection/call was initiated */
    callStartTime: number | null;
    /** LiveKit WebSocket URL for room connection */
    private readonly lkUrl;
    /** JWT access token for room authentication */
    private readonly accessToken;
    /** Counter for total connection attempts (including retries) */
    private connectionAttempts;
    /** Counter for reconnection attempts after initial connection */
    private reconnectionAttempts;
    /** Whether we've already emitted a 'connected' event for the current session */
    private hasEmittedConnected;
    /** Debug logger instance for conditional logging */
    private readonly logger;
    /**
     * Creates a new LiveKitConnection instance
     *
     * Initializes a LiveKit room with optimized WebRTC configuration for
     * voice agent communication, including adaptive streaming and bandwidth
     * management features.
     *
     * @param lkUrl - LiveKit WebSocket URL (e.g., 'wss://livekit.example.com')
     * @param accessToken - JWT token for room authentication and authorization
     * @param debug - Enable debug logging (defaults to false)
     *
     * @example
     * ```typescript
     * const connection = new LiveKitConnection(
     *   'wss://rtc.eu.tryhamsa.com',
     *   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
     *   false
     * );
     *
     * // Connection is ready for use
     * await connection.connect();
     * ```
     */
    constructor(lkUrl: string, accessToken: string, debug?: boolean);
    /**
     * Provides access to the underlying LiveKit room instance
     *
     * Exposes the LiveKit room for advanced operations that require direct
     * access to the WebRTC room functionality. Use with caution as direct
     * manipulation may interfere with connection management.
     *
     * @returns LiveKit Room instance or null if not initialized
     *
     * @example
     * ```typescript
     * const room = connection.getRoom();
     * if (room) {
     *   // Access advanced LiveKit features
     *   console.log('Room name:', room.name);
     *   console.log('Local participant:', room.localParticipant?.identity);
     * }
     * ```
     */
    getRoom(): Room | null;
    /**
     * Establishes connection to the LiveKit room with performance optimization
     *
     * Initiates the WebRTC connection process with connection pre-warming for
     * faster establishment times. Tracks connection performance metrics and
     * handles authentication through the provided JWT token.
     *
     * @throws {Error} Connection failures due to network issues, authentication problems, or server unavailability
     *
     * @example
     * ```typescript
     * try {
     *   // Set up event listeners first
     *   connection.on('connected', () => {
     *     console.log('Successfully connected to voice agent');
     *     enableVoiceFeatures();
     *   });
     *
     *   connection.on('connectionError', (error) => {
     *     console.error('Connection failed:', error.message);
     *     handleConnectionFailure(error);
     *   });
     *
     *   // Initiate connection
     *   await connection.connect();
     * } catch (error) {
     *   console.error('Failed to connect:', error);
     * }
     * ```
     *
     * @example Connection Performance Monitoring
     * ```typescript
     * connection.on('connectionEstablished', (timeMs) => {
     *   console.log(`Connection established in ${timeMs}ms`);
     *
     *   if (timeMs > 5000) {
     *     logSlowConnection(timeMs);
     *   }
     * });
     *
     * await connection.connect();
     * ```
     */
    connect(): Promise<void>;
    /**
     * Force disconnection for testing
     */
    forceDisconnect(): void;
    /**
     * Disconnects from the LiveKit room
     */
    disconnect(): Promise<void>;
    /**
     * Pauses the connection by muting local microphone
     */
    pause(): void;
    /**
     * Resumes the connection by unmuting local microphone
     */
    resume(): void;
    /**
     * Gets connection statistics
     */
    getConnectionStats(): {
        connectionAttempts: number;
        reconnectionAttempts: number;
        isConnected: boolean;
        participantCount: number;
    };
    /**
     * Gets connection attempts
     */
    getConnectionAttempts(): number;
    /**
     * Gets reconnection attempts
     */
    getReconnectionAttempts(): number;
    /**
     * Gets current participants
     */
    getParticipants(): ParticipantData[];
    /**
     * Public cleanup method for external access
     */
    cleanup(): void;
}
