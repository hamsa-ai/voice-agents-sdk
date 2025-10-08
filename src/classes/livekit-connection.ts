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
import {
  type ConnectionState,
  type Participant,
  type RemoteParticipant,
  Room,
  RoomEvent,
  VideoPresets,
} from 'livekit-client';
import type { ParticipantData } from './types';

/**
 * LiveKitConnection class for managing WebRTC connections to voice agent rooms
 *
 * Extends EventEmitter to provide real-time connection status updates and
 * participant management events for voice agent applications.
 */
export class LiveKitConnection extends EventEmitter {
  /** LiveKit room instance for WebRTC communication */
  room: Room | null = null;

  /** Current connection status to the LiveKit room */
  isConnected = false;

  /** Whether the conversation is currently paused (microphone muted) */
  isPaused = false;

  /** Map of active participants in the room with their metadata */
  participants: Map<string, ParticipantData> = new Map();

  /** Unix timestamp when the connection/call was initiated */
  callStartTime: number | null = null;

  /** LiveKit WebSocket URL for room connection */
  private readonly lkUrl: string;

  /** JWT access token for room authentication */
  private readonly accessToken: string;

  /** Counter for total connection attempts (including retries) */
  // biome-ignore lint/style/useReadonlyClassProperties: connectionAttempts is incremented in connect()
  private connectionAttempts = 0;

  /** Counter for reconnection attempts after initial connection */
  private reconnectionAttempts = 0;

  /** Whether we've already emitted a 'connected' event for the current session */
  private hasEmittedConnected = false;

  /**
   * Creates a new LiveKitConnection instance
   *
   * Initializes a LiveKit room with optimized WebRTC configuration for
   * voice agent communication, including adaptive streaming and bandwidth
   * management features.
   *
   * @param lkUrl - LiveKit WebSocket URL (e.g., 'wss://livekit.example.com')
   * @param accessToken - JWT token for room authentication and authorization
   *
   * @example
   * ```typescript
   * const connection = new LiveKitConnection(
   *   'wss://rtc.eu.tryhamsa.com',
   *   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
   * );
   *
   * // Connection is ready for use
   * await connection.connect();
   * ```
   */
  constructor(lkUrl: string, accessToken: string) {
    super();
    this.lkUrl = lkUrl;
    this.accessToken = accessToken;

    // Initialize LiveKit Room with optimal configuration for voice agents
    this.room = new Room({
      // Enable adaptive streaming for optimal bandwidth usage
      adaptiveStream: true,
      // Enable dynacast for efficient bandwidth management
      dynacast: true,
      // Configure video settings for potential future video features
      videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
      },
      // Enable echo cancellation and noise suppression for clearer audio
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    // Set up event handlers for room lifecycle management
    this.#setupRoomEventHandlers();
  }

  /**
   * Configures comprehensive event handlers for LiveKit room lifecycle management
   *
   * Sets up listeners for all critical room events including connection state changes,
   * participant management, and reconnection handling. These handlers forward events
   * to the LiveKitConnection EventEmitter for external consumption.
   *
   * @private
   */
  #setupRoomEventHandlers(): void {
    if (!this.room) {
      return;
    }

    this.room
      .on(RoomEvent.Connected, this.#handleConnected.bind(this))
      .on(RoomEvent.Disconnected, this.#handleDisconnected.bind(this))
      .on(RoomEvent.Reconnecting, this.#handleReconnecting.bind(this))
      .on(RoomEvent.Reconnected, this.#handleReconnected.bind(this))
      .on(
        RoomEvent.ParticipantConnected,
        this.#handleParticipantConnected.bind(this)
      )
      .on(
        RoomEvent.ParticipantDisconnected,
        this.#handleParticipantDisconnected.bind(this)
      )
      .on(
        RoomEvent.ParticipantAttributesChanged,
        this.#handleParticipantAttributesChanged.bind(this)
      )
      .on(
        RoomEvent.ConnectionStateChanged,
        this.#handleConnectionStateChanged.bind(this)
      );
  }

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
  getRoom(): Room | null {
    return this.room;
  }

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
  async connect(): Promise<void> {
    try {
      // Record call initiation time for performance metrics
      this.callStartTime = Date.now();
      this.connectionAttempts++;

      // Pre-warm connection for optimized establishment time
      this.room?.prepareConnection(this.lkUrl, this.accessToken);

      // Track connection establishment performance
      const connectionStart = Date.now();

      // Establish secure WebRTC connection to LiveKit room
      await this.room?.connect(this.lkUrl, this.accessToken);

      // Emit connection timing metrics for performance monitoring
      const connectionTime = Date.now() - connectionStart;
      this.emit('connectionEstablished', connectionTime);

      // Mark as connected and emit 'connected' once. In some test environments,
      // RoomEvent.Connected may not fire, so we emit here as a fallback.
      this.isConnected = true;
      if (!this.hasEmittedConnected) {
        this.emit('connected');
        this.hasEmittedConnected = true;
      }
    } catch (error) {
      this.emit(
        'connectionError',
        new Error(
          `LiveKit connection failed: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  /**
   * Force disconnection for testing
   */
  forceDisconnect(): void {
    this.isConnected = false;
    this.emit('disconnected');
    this.#cleanup();
  }

  /**
   * Disconnects from the LiveKit room
   */
  async disconnect(): Promise<void> {
    try {
      if (this.room) {
        await this.room.disconnect();
      }
      this.#cleanup();
    } catch (error) {
      this.emit(
        'connectionError',
        new Error(
          `LiveKit disconnection failed: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  /**
   * Pauses the connection by muting local microphone
   */
  pause(): void {
    try {
      this.isPaused = true;

      // Mute local microphone
      if (this.room?.localParticipant) {
        this.room.localParticipant.setMicrophoneEnabled(false);
      }

      this.emit('connectionPaused');
    } catch (error) {
      this.emit(
        'connectionError',
        new Error(
          `Failed to pause call: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  /**
   * Resumes the connection by unmuting local microphone
   */
  resume(): void {
    try {
      this.isPaused = false;

      // Unmute local microphone
      if (this.room?.localParticipant) {
        this.room.localParticipant.setMicrophoneEnabled(true);
      }

      this.emit('connectionResumed');
    } catch (error) {
      this.emit(
        'connectionError',
        new Error(
          `Failed to resume call: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  /**
   * Gets connection statistics
   */
  getConnectionStats(): {
    connectionAttempts: number;
    reconnectionAttempts: number;
    isConnected: boolean;
    participantCount: number;
  } {
    return {
      connectionAttempts: this.connectionAttempts,
      reconnectionAttempts: this.reconnectionAttempts,
      isConnected: this.isConnected,
      participantCount: this.participants.size,
    };
  }

  /**
   * Gets connection attempts
   */
  getConnectionAttempts(): number {
    return this.connectionAttempts;
  }

  /**
   * Gets reconnection attempts
   */
  getReconnectionAttempts(): number {
    return this.reconnectionAttempts;
  }

  /**
   * Gets current participants
   */
  getParticipants(): ParticipantData[] {
    return Array.from(this.participants.values());
  }

  /**
   * Handles successful room connection
   */
  async #handleConnected(): Promise<void> {
    try {
      this.isConnected = true;

      // Enable microphone after connection
      await this.room?.localParticipant?.setMicrophoneEnabled(true);

      // Emit 'connected' only once per session
      if (!this.hasEmittedConnected) {
        this.emit('connected');
        this.hasEmittedConnected = true;
      }
    } catch (error) {
      this.emit(
        'connectionError',
        new Error(
          `Failed to initialize after connection: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  /**
   * Handles room disconnection
   */
  #handleDisconnected(): void {
    this.isConnected = false;
    this.emit('disconnected');
    this.#cleanup();
  }

  /**
   * Handles reconnection attempts
   */
  #handleReconnecting(): void {
    this.reconnectionAttempts++;
    this.emit('reconnecting');
  }

  /**
   * Handles successful reconnection
   */
  #handleReconnected(): void {
    this.isConnected = true;
    this.emit('reconnected');
  }

  /**
   * Handles participant connection
   */
  #handleParticipantConnected(participant: RemoteParticipant): void {
    this.participants.set(participant.sid || 'unknown', {
      identity: participant.identity || 'unknown',
      sid: participant.sid || 'unknown',
      connectionTime: Date.now(),
      metadata: participant.metadata,
    });
    this.emit('participantConnected', participant);
  }

  /**
   * Handles participant disconnection
   */
  #handleParticipantDisconnected(participant: RemoteParticipant): void {
    this.participants.delete(participant.sid || 'unknown');
    this.emit('participantDisconnected', participant);
  }

  /**
   * Handles participant attributes changed
   * Monitors the 'lk.agent.state' attribute to track agent state changes
   */
  #handleParticipantAttributesChanged(
    changedAttributes: Record<string, string>,
    _participant: Participant
  ): void {
    // Check if the agent state attribute changed
    if ('lk.agent.state' in changedAttributes) {
      const agentState = changedAttributes['lk.agent.state'];
      if (agentState !== undefined) {
        this.emit('agentStateChanged', agentState);
      }
    }
  }

  /**
   * Handles connection state changes
   */
  #handleConnectionStateChanged(state: ConnectionState): void {
    this.emit('connectionStateChanged', state);
  }

  /**
   * Cleans up connection resources
   */
  #cleanup(): void {
    // Clear participant data
    this.participants.clear();
    this.isConnected = false;
    this.isPaused = false;
    this.hasEmittedConnected = false;
  }

  /**
   * Public cleanup method for external access
   */
  cleanup(): void {
    this.#cleanup();
  }
}
