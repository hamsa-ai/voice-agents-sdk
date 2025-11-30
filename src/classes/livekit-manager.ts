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
import type {
  ConnectionQuality,
  LocalTrackPublication,
  Participant,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
} from 'livekit-client';
import { RoomEvent } from 'livekit-client';
import { createDebugLogger, type DebugLogger } from '../utils';
import { LiveKitAnalytics } from './livekit-analytics';
import { LiveKitAudioManager } from './livekit-audio-manager';
import { LiveKitConnection } from './livekit-connection';
import { LiveKitToolRegistry } from './livekit-tool-registry';

import type {
  AgentState,
  AudioLevelsResult,
  CallAnalyticsResult,
  ConnectionStatsResult,
  ParticipantData,
  PerformanceMetricsResult,
  Tool,
  TrackStatsResult,
} from './types';

// Re-export types for external consumption
export type {
  AgentState,
  AudioLevelsResult,
  CallAnalyticsResult,
  ConnectionStatsResult,
  ParticipantData,
  PerformanceMetricsResult,
  TrackStatsData,
  TrackStatsResult,
} from './types';

/**
 * Main LiveKitManager class that orchestrates voice agent communication
 *
 * This class extends EventEmitter to provide a reactive interface for handling
 * voice agent interactions, real-time analytics, and WebRTC connection management.
 */
export default class LiveKitManager extends EventEmitter {
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
  constructor(
    lkUrl: string,
    accessToken: string,
    tools: Tool[] = [],
    debug = false
  ) {
    super();

    this.lkUrl = lkUrl;
    this.accessToken = accessToken;
    this.logger = createDebugLogger(debug);

    this.logger.log('Initializing LiveKitManager', {
      source: 'LiveKitManager',
      error: {
        lkUrl,
        toolsCount: tools.length,
        debug,
      },
    });

    // Initialize specialized modules with their specific responsibilities
    this.logger.log('Creating LiveKitConnection module', {
      source: 'LiveKitManager',
    });
    this.connection = new LiveKitConnection(lkUrl, accessToken, debug);

    this.logger.log('Creating LiveKitAnalytics module', {
      source: 'LiveKitManager',
    });
    this.analytics = new LiveKitAnalytics();

    this.logger.log('Creating LiveKitAudioManager module', {
      source: 'LiveKitManager',
    });
    this.audioManager = new LiveKitAudioManager();

    this.logger.log('Creating LiveKitToolRegistry module', {
      source: 'LiveKitManager',
      error: { toolsCount: tools.length },
    });
    this.toolRegistry = new LiveKitToolRegistry(tools);

    if (tools.length > 0) {
      this.logger.log('Registered client-side tools', {
        source: 'LiveKitManager',
        error: {
          toolNames: tools.map((t) => t.function_name),
          totalTools: tools.length,
        },
      });
    }

    // Establish communication channels between modules
    this.logger.log('Setting up module communication', {
      source: 'LiveKitManager',
    });
    this.#setupModuleCommunication();

    // Configure event forwarding from modules to external consumers
    this.logger.log('Setting up event forwarding', {
      source: 'LiveKitManager',
    });
    this.#setupEventForwarding();

    // Configure LiveKit room event handlers for WebRTC events
    this.logger.log('Setting up room event handlers', {
      source: 'LiveKitManager',
    });
    this.#setupRoomEventHandlers();

    this.logger.log('LiveKitManager initialization complete', {
      source: 'LiveKitManager',
    });
  }

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
  async connect(): Promise<void> {
    if (this.connection.isConnected) {
      this.logger.log('Already connected, skipping duplicate connection', {
        source: 'LiveKitManager',
      });
      // Already connected - silently return to avoid duplicate connections
      return;
    }

    this.logger.log('Starting LiveKit room connection', {
      source: 'LiveKitManager',
    });

    // Track connection attempt in analytics before establishing connection
    const currentStats = this.connection.getConnectionStats();
    this.logger.log('Updating connection analytics', {
      source: 'LiveKitManager',
      error: {
        currentAttempts: currentStats.connectionAttempts,
        reconnectionAttempts: currentStats.reconnectionAttempts,
      },
    });
    this.analytics.updateConnectionStats(
      currentStats.connectionAttempts + 1,
      currentStats.reconnectionAttempts
    );

    const connectStart = Date.now();
    await this.connection.connect();
    const connectDuration = Date.now() - connectStart;
    this.logger.log('LiveKit room connection established', {
      source: 'LiveKitManager',
      error: {
        duration: `${connectDuration}ms`,
      },
    });

    // Provide the connected room to the audio manager
    if (this.connection.room) {
      this.audioManager.setRoom(this.connection.room);
    }
  }

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
  async disconnect(): Promise<void> {
    const disconnectStartTime = Date.now();
    this.logger.log('LiveKitManager.disconnect() - START', {
      source: 'LiveKitManager',
      error: {
        timestamp: disconnectStartTime,
        isConnected: this.connection.isConnected,
        participantCount: this.connection.participants.size,
        hasRoom: !!this.connection.room,
      },
    });

    const connectionDisconnectStart = Date.now();
    await this.connection.disconnect();
    const connectionDisconnectEnd = Date.now();

    this.logger.log(
      'LiveKitManager.disconnect() - connection.disconnect() completed',
      {
        source: 'LiveKitManager',
        error: {
          timestamp: connectionDisconnectEnd,
          connectionDisconnectDuration:
            connectionDisconnectEnd - connectionDisconnectStart,
        },
      }
    );

    // Perform comprehensive cleanup of all modules
    const cleanupStart = Date.now();
    this.logger.log('Performing cleanup of all modules', {
      source: 'LiveKitManager',
      error: {
        timestamp: cleanupStart,
      },
    });
    this.cleanup();
    const cleanupEnd = Date.now();

    this.logger.log('LiveKitManager.disconnect() - COMPLETE', {
      source: 'LiveKitManager',
      error: {
        timestamp: cleanupEnd,
        cleanupDuration: cleanupEnd - cleanupStart,
        totalDisconnectDuration: cleanupEnd - disconnectStartTime,
      },
    });
  }

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
  pause(): void {
    this.logger.log('Pausing voice conversation', {
      source: 'LiveKitManager',
      error: {
        isConnected: this.connection.isConnected,
        wasPaused: this.connection.isPaused,
      },
    });
    this.connection.pause();
    this.audioManager.pauseAllAudio();
    this.logger.log('Voice conversation paused', {
      source: 'LiveKitManager',
    });
  }

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
  resume(): void {
    this.logger.log('Resuming voice conversation', {
      source: 'LiveKitManager',
      error: {
        isConnected: this.connection.isConnected,
        wasPaused: this.connection.isPaused,
      },
    });
    this.connection.resume();
    this.audioManager.resumeAllAudio();
    this.logger.log('Voice conversation resumed', {
      source: 'LiveKitManager',
    });
  }

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
  setVolume(volume: number): void {
    const PERCENTAGE_MULTIPLIER = 100;
    this.logger.log('Setting audio volume', {
      source: 'LiveKitManager',
      error: {
        volume,
        percentage: `${Math.round(volume * PERCENTAGE_MULTIPLIER)}%`,
      },
    });
    this.audioManager.setVolume(volume);
  }

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
  get room(): Room | null {
    return this.connection.room;
  }

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
  get isConnected(): boolean {
    return this.connection.isConnected;
  }

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
  get isPaused(): boolean {
    return this.connection.isPaused;
  }

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
  get volume(): number {
    return this.audioManager.volume;
  }

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
  get audioElements(): Set<HTMLAudioElement> {
    return this.audioManager.audioElements;
  }

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
  get tools(): Tool[] {
    return this.toolRegistry.getTools();
  }

  /**
   * Gets raw call statistics from the analytics module
   *
   * @returns Internal call statistics object with WebRTC metrics
   * @internal
   */
  get callStats() {
    return this.analytics.callStats;
  }

  /**
   * Gets raw connection metrics from the analytics module
   *
   * @returns Internal connection metrics object
   * @internal
   */
  get connectionMetrics() {
    return this.analytics.connectionMetrics;
  }

  /**
   * Gets raw audio metrics from the analytics module
   *
   * @returns Internal audio metrics object
   * @internal
   */
  get audioMetrics() {
    return this.analytics.audioMetrics;
  }

  /**
   * Gets raw performance metrics from the analytics module
   *
   * @returns Internal performance metrics object
   * @internal
   */
  get performanceMetrics() {
    return this.analytics.performanceMetrics;
  }

  /**
   * Gets the analytics collection interval timer
   *
   * @returns NodeJS.Timeout for the analytics interval, or null if not collecting
   * @internal
   */
  get analyticsInterval() {
    return this.analytics.analyticsInterval;
  }

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
  get callStartTime(): number | null {
    return this.analytics.callStartTime || this.connection.callStartTime;
  }

  /**
   * Gets the map of active participants in the room
   *
   * @returns Map of participant SIDs to Participant objects
   * @internal Use getParticipants() for structured participant data
   */
  get participants() {
    return this.connection.participants;
  }

  /**
   * Gets the raw track statistics map
   *
   * @returns Map of track IDs to track data objects
   * @internal Use getTrackStats() for structured track statistics
   */
  get trackStats() {
    return this.audioManager.trackStats;
  }

  // === Public Analytics Methods ===

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
  getConnectionStats(): ConnectionStatsResult {
    return this.analytics.getConnectionStats();
  }

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
  getAudioLevels(): AudioLevelsResult & { isPaused: boolean; volume: number } {
    const audioLevels = this.analytics.getAudioLevels();
    return {
      ...audioLevels,
      isPaused: this.connection.isPaused,
      volume: this.audioManager.volume,
    };
  }

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
  getPerformanceMetrics(): PerformanceMetricsResult {
    return this.analytics.getPerformanceMetrics();
  }

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
  getParticipants(): ParticipantData[] {
    return this.connection.getParticipants();
  }

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
  getTrackStats(): TrackStatsResult {
    return this.audioManager.getTrackStats();
  }

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
  getCallAnalytics(): CallAnalyticsResult {
    return this.analytics.getCallAnalytics(
      this.getParticipants(),
      this.getTrackStats(),
      this.audioManager.volume,
      this.connection.isPaused
    );
  }

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
  registerTools(tools?: Tool[]): void {
    this.logger.log('Registering client-side tools', {
      source: 'LiveKitManager',
      error: {
        newToolsCount: Array.isArray(tools) ? tools.length : 0,
        hasRoom: !!this.room,
        isConnected: this.connection.isConnected,
      },
    });

    if (Array.isArray(tools) && tools.length > 0) {
      this.logger.log('Setting new tools in registry', {
        source: 'LiveKitManager',
        error: {
          toolNames: tools.map((t) => t.function_name),
          totalTools: tools.length,
        },
      });
      this.toolRegistry.setTools(tools);
    }

    // Ensure the tool registry has access to the room for RPC registration
    if (this.room) {
      this.toolRegistry.setRoom(this.room);
    }

    this.toolRegistry.registerTools();
    this.logger.log('Tools registration complete', {
      source: 'LiveKitManager',
      error: {
        registeredTools: this.toolRegistry.getTools().length,
      },
    });
  }

  /**
   * Establishes inter-module communication channels and event coordination
   *
   * This private method sets up the complex event flow between the four specialized
   * modules (connection, analytics, audio, tools) to ensure proper coordination
   * and data sharing throughout the voice agent session lifecycle.
   *
   * Key responsibilities:
   * - Share room references between modules when connection is established
   * - Coordinate analytics collection with connection state changes
   * - Update metrics when participants and tracks change
   * - Ensure proper cleanup when disconnected
   *
   * @private
   */
  #setupModuleCommunication(): void {
    // When connection is established, distribute room reference and initialize modules
    this.connection.on('connected', () => {
      const room = this.connection.room;

      // Distribute room reference to modules that need direct access
      this.analytics.setRoom(room);
      this.toolRegistry.setRoom(room);
      this.audioManager.setRoom(room);

      // Initialize analytics tracking with connection state and start time
      this.analytics.setConnectionState(true, this.connection.callStartTime);

      // Register any tools that were provided during construction
      this.toolRegistry.registerTools();

      // Begin periodic analytics data collection
      this.analytics.startAnalyticsCollection();

      // Local tracks will be exposed via localTrackPublished event when they become available

      // Setup WebRTC event handlers that require module coordination
      this.#setupRoomEventHandlers();
    });

    // Record precise connection establishment timing for performance metrics
    this.connection.on('connectionEstablished', (time: number) => {
      this.analytics.setConnectionEstablishedTime(time);
    });

    // Update analytics with successful connection statistics
    this.connection.on('connected', () => {
      const stats = this.connection.getConnectionStats();
      this.analytics.updateConnectionStats(
        stats.connectionAttempts,
        stats.reconnectionAttempts
      );
    });

    // Update analytics with reconnection attempt statistics
    this.connection.on('reconnecting', () => {
      const stats = this.connection.getConnectionStats();
      this.analytics.updateConnectionStats(
        stats.connectionAttempts,
        stats.reconnectionAttempts
      );
    });

    // Perform comprehensive cleanup when connection is terminated
    this.connection.on('disconnected', () => {
      this.analytics.stopAnalyticsCollection();
      this.analytics.setConnectionState(false);
      this.audioManager.cleanup();
      this.toolRegistry.cleanup();
      this.analytics.cleanup();
    });

    // Keep analytics updated with real-time participant and track counts
    this.connection.on('participantConnected', () => {
      this.#updateAnalyticsCounts();
    });

    this.connection.on('participantDisconnected', () => {
      this.#updateAnalyticsCounts();
    });

    this.audioManager.on('trackSubscribed', () => {
      this.#updateAnalyticsCounts();
    });

    this.audioManager.on('trackUnsubscribed', () => {
      this.#updateAnalyticsCounts();
    });
  }

  /**
   * Configures event forwarding from specialized modules to external consumers
   *
   * This private method creates a unified event interface by forwarding events
   * from the four specialized modules (connection, analytics, audio, tools) to
   * the main LiveKitManager EventEmitter. This allows external code to listen
   * to all events from a single source while maintaining modular architecture.
   *
   * Event categories forwarded:
   * - Connection events: connected, disconnected, reconnecting, participants
   * - Audio events: track subscriptions, speaking states, volume changes
   * - Analytics events: quality changes, metrics updates, playback status
   * - Tool/Data events: agent responses, transcriptions, custom events, RPC calls
   *
   * @private
   */
  #setupEventForwarding(): void {
    // === Connection Events ===
    // Forward connection lifecycle events for monitoring connection state
    this.connection.on('connected', () => this.emit('connected'));
    this.connection.on('disconnected', () => this.emit('disconnected'));
    this.connection.on('reconnecting', () => this.emit('reconnecting'));
    this.connection.on('reconnected', () => this.emit('reconnected'));

    // Forward participant management events for tracking room occupancy
    this.connection.on('participantConnected', (participant) =>
      this.emit('participantConnected', participant)
    );
    this.connection.on('participantDisconnected', (participant) =>
      this.emit('participantDisconnected', participant)
    );

    // Forward agent state changes for tracking agent behavior (listening, thinking, speaking)
    this.connection.on('agentStateChanged', (state: AgentState) =>
      this.emit('agentStateChanged', state)
    );

    // Forward connection state and error events for external error handling
    this.connection.on('connectionStateChanged', (state) =>
      this.emit('connectionStateChanged', state)
    );
    this.connection.on('connectionError', (error) => {
      if (this.listenerCount('error') > 0) {
        this.emit('error', error);
      }
    });

    // === Audio Events ===
    // Forward audio track management events for media stream monitoring
    this.audioManager.on('trackSubscribed', (data) =>
      this.emit('trackSubscribed', data)
    );
    this.audioManager.on('trackUnsubscribed', (data) =>
      this.emit('trackUnsubscribed', data)
    );

    // Forward speaking state events for conversation flow tracking
    this.audioManager.on('speaking', () => this.emit('speaking'));
    this.audioManager.on('listening', () => this.emit('listening'));

    // Forward volume control events for UI synchronization
    this.audioManager.on('volumeChanged', (volume) =>
      this.emit('volumeChanged', volume)
    );
    this.audioManager.on('error', (error) => {
      if (this.listenerCount('error') > 0) {
        this.emit('error', error);
      }
    });

    // Forward microphone control events for UI synchronization
    this.audioManager.on('micMuted', () => this.emit('micMuted'));
    this.audioManager.on('micUnmuted', () => this.emit('micUnmuted'));

    // === Analytics Events ===
    // Forward real-time quality monitoring events for dashboard updates
    this.analytics.on('connectionQualityChanged', (data) =>
      this.emit('connectionQualityChanged', data)
    );
    this.analytics.on('audioPlaybackChanged', (playing) =>
      this.emit('audioPlaybackChanged', playing)
    );

    // Forward periodic analytics updates for comprehensive monitoring
    this.analytics.on('analyticsUpdated', (analytics) =>
      this.emit('analyticsUpdated', analytics)
    );

    // === Tool and Data Events ===
    // Forward agent communication events for conversation tracking
    this.toolRegistry.on('answerReceived', (answer) =>
      this.emit('answerReceived', answer)
    );
    this.toolRegistry.on('transcriptionReceived', (transcription) =>
      this.emit('transcriptionReceived', transcription)
    );

    // Forward custom agent events for application-specific logic
    this.toolRegistry.on('customEvent', (eventType, eventData, metadata) =>
      this.emit('customEvent', eventType, eventData, metadata)
    );

    // Forward raw data events for advanced integrations
    this.toolRegistry.on('dataReceived', (message, participant) =>
      this.emit('dataReceived', message, participant)
    );

    // Local audio tracks are now exposed via localTrackPublished event
    // No need for stream-specific forwarding

    // Forward tool registration confirmations for debugging
    this.toolRegistry.on('toolsRegistered', (count) =>
      this.emit('toolsRegistered', count)
    );
  }

  /**
   * Configures LiveKit room event handlers that require coordination between modules
   *
   * This private method sets up WebRTC-level event handlers that need to coordinate
   * actions across multiple modules. These handlers respond to low-level LiveKit
   * events and delegate processing to the appropriate specialized modules.
   *
   * Events handled:
   * - TrackSubscribed/Unsubscribed: Audio stream management and analytics updates
   * - DataReceived: Tool execution and custom message processing
   * - TranscriptionReceived: Speech-to-text processing and forwarding
   * - ConnectionQualityChanged: Real-time quality monitoring and analytics
   * - AudioPlaybackStatusChanged: Playback state tracking for analytics
   * - MediaDevicesError: Hardware error handling and reporting
   *
   * @private
   */
  #setupRoomEventHandlers(): void {
    const room = this.connection.room;
    if (!room) {
      return;
    }

    // Define WebRTC event handlers with module coordination
    const eventHandlers = [
      [
        RoomEvent.TrackSubscribed,
        (
          track: RemoteTrack,
          publication: RemoteTrackPublication,
          participant: RemoteParticipant
        ) => {
          this.logger.log('Track subscribed', {
            source: 'LiveKitManager',
            error: {
              trackSid: track.sid,
              trackKind: track.kind,
              participantIdentity: participant.identity,
              isMuted: publication.isMuted,
            },
          });

          // Delegate audio track processing to audio manager
          // Note: audioManager.handleTrackSubscribed will emit the trackSubscribed event
          this.audioManager.handleTrackSubscribed(
            track,
            publication,
            participant
          );
        },
      ],
      [
        RoomEvent.TrackUnsubscribed,
        (
          track: RemoteTrack,
          publication: RemoteTrackPublication,
          participant: RemoteParticipant
        ) => {
          this.logger.log('Track unsubscribed', {
            source: 'LiveKitManager',
            error: {
              trackSid: track.sid,
              trackKind: track.kind,
              participantIdentity: participant.identity,
            },
          });

          // Delegate audio track cleanup to audio manager
          // Note: audioManager.handleTrackUnsubscribed will emit the trackUnsubscribed event
          this.audioManager.handleTrackUnsubscribed(
            track,
            publication,
            participant
          );
        },
      ],
      [
        RoomEvent.DataReceived,
        (payload: Uint8Array, participant?: RemoteParticipant) => {
          this.logger.log('Data received from participant', {
            source: 'LiveKitManager',
            error: {
              payloadSize: payload.length,
              participantIdentity: participant?.identity || 'unknown',
            },
          });

          // Delegate data processing to tool registry for RPC handling
          this.toolRegistry.handleDataReceived(payload, participant?.identity);
        },
      ],
      [
        RoomEvent.TranscriptionReceived,
        (transcriptions: Array<{ text?: string; final?: boolean }>) => {
          // Delegate transcription processing to tool registry
          this.toolRegistry.handleTranscriptionReceived(transcriptions);
        },
      ],
      [
        RoomEvent.ConnectionQualityChanged,
        (quality: ConnectionQuality, participant: Participant) => {
          this.logger.log('Connection quality changed', {
            source: 'LiveKitManager',
            error: {
              quality,
              participantIdentity: participant.identity,
              isLocal: participant.isLocal,
            },
          });

          // Delegate quality monitoring to analytics module
          this.analytics.handleConnectionQualityChanged(quality, participant);
        },
      ],
      [
        RoomEvent.AudioPlaybackStatusChanged,
        (playing: boolean) => {
          this.logger.log('Audio playback status changed', {
            source: 'LiveKitManager',
            error: {
              playing,
              state: playing ? 'started' : 'stopped',
            },
          });

          // Delegate playback state tracking to analytics module
          this.analytics.handleAudioPlaybackChanged(playing);
        },
      ],
      [
        RoomEvent.MediaDevicesError,
        (error: Error) => {
          this.logger.error('Media devices error', {
            source: 'LiveKitManager',
            error: {
              message: error.message,
              name: error.name,
            },
          });

          // Forward media device errors for external error handling
          this.emit('mediaDevicesError', error);
        },
      ],
      [
        RoomEvent.LocalTrackPublished,
        (publication: LocalTrackPublication) => {
          this.logger.log('Local track published', {
            source: 'LiveKitManager',
            error: {
              trackSid: publication.trackSid,
              trackKind: publication.kind,
              isMuted: publication.isMuted,
            },
          });

          // Forward local track publication event with track data
          this.emit('localTrackPublished', {
            publication,
            track: publication.track,
          });
        },
      ],
    ];

    // Register all event handlers with the LiveKit room
    for (const [event, handler] of eventHandlers) {
      // biome-ignore lint/suspicious/noExplicitAny: Room event handling requires flexible typing for different handler signatures
      room.on(event as any, handler);
    }
  }

  /**
   * Updates analytics with current participant and track counts
   *
   * This private helper method synchronizes the analytics module with the current
   * state of participants and tracks, ensuring accurate metrics reporting.
   * Called whenever participants join/leave or tracks are added/removed.
   *
   * @private
   */
  #updateAnalyticsCounts(): void {
    const participantCount = this.connection.participants.size;
    const trackCount = this.audioManager.trackStats.size;
    this.logger.log('Updating analytics counts', {
      source: 'LiveKitManager',
      error: {
        participants: participantCount,
        tracks: trackCount,
      },
    });
    this.analytics.updateCounts(participantCount, trackCount);
  }

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
  cleanup(): void {
    this.connection.cleanup();
    this.audioManager.cleanup();
    this.analytics.cleanup();
    this.toolRegistry.cleanup();
  }
}
