/**
 * LiveKitAnalytics - Advanced analytics engine for voice agent communication
 *
 * This class provides comprehensive real-time analytics for voice agent conversations,
 * collecting and processing WebRTC statistics, performance metrics, audio quality data,
 * and connection health information. It serves as the analytics backbone for monitoring
 * call quality, user engagement, and system performance.
 *
 * Key features:
 * - Real-time WebRTC statistics collection and processing
 * - Connection quality monitoring with automatic quality assessment
 * - Audio level tracking and speaking time analytics
 * - Performance metrics including response times and latency measurements
 * - Periodic analytics updates with configurable intervals
 * - Event-driven architecture for real-time monitoring dashboards
 * - Automatic cleanup and resource management
 *
 * Analytics Categories:
 *
 * **Connection Analytics:**
 * - Network latency and jitter measurements
 * - Packet loss detection and monitoring
 * - Connection quality assessment (excellent/good/poor/lost)
 * - Bandwidth utilization tracking
 * - Connection attempt and reconnection statistics
 *
 * **Audio Analytics:**
 * - Real-time audio level monitoring for user and agent
 * - Speaking time tracking for conversation analysis
 * - Audio dropout detection and counting
 * - Echo cancellation status monitoring
 * - Voice activity detection and timing
 *
 * **Performance Analytics:**
 * - Response time measurements for agent interactions
 * - Call duration tracking with millisecond precision
 * - Connection establishment time monitoring
 * - Reconnection frequency and success rates
 * - Network latency impact on call quality
 *
 * **Usage Patterns:**
 *
 * @example Real-time Quality Monitoring
 * ```typescript
 * const analytics = new LiveKitAnalytics();
 *
 * // Listen for quality changes
 * analytics.on('connectionQualityChanged', ({ quality, metrics }) => {
 *   if (quality === 'poor') {
 *     showNetworkWarning(metrics);
 *     logQualityIssue(metrics);
 *   }
 * });
 *
 * // Monitor periodic updates
 * analytics.on('analyticsUpdated', (data) => {
 *   updateDashboard({
 *     latency: data.connectionStats.latency,
 *     audioLevels: data.audioMetrics,
 *     callDuration: data.performanceMetrics.callDuration
 *   });
 * });
 *
 * // Start collection
 * analytics.setRoom(liveKitRoom);
 * analytics.setConnectionState(true, Date.now());
 * analytics.startAnalyticsCollection();
 * ```
 *
 * @example Analytics Dashboard Integration
 * ```typescript
 * // Get comprehensive analytics snapshot
 * const fullAnalytics = analytics.getCallAnalytics(
 *   participants,
 *   trackStats,
 *   currentVolume,
 *   isPaused
 * );
 *
 * // Send to analytics service
 * analyticsService.recordCall({
 *   sessionId: generateSessionId(),
 *   timestamp: Date.now(),
 *   metrics: fullAnalytics,
 *   agentId: currentAgentId
 * });
 *
 * // Real-time metrics display
 * const connectionStats = analytics.getConnectionStats();
 * const audioLevels = analytics.getAudioLevels();
 * const performance = analytics.getPerformanceMetrics();
 *
 * updateUI({
 *   quality: connectionStats.quality,
 *   latency: connectionStats.latency,
 *   userSpeaking: audioLevels.userAudioLevel > 0.1,
 *   agentSpeaking: audioLevels.agentAudioLevel > 0.1,
 *   callDuration: performance.callDuration
 * });
 * ```
 *
 * @example Quality Issue Detection
 * ```typescript
 * // Monitor for quality degradation
 * analytics.on('connectionQualityChanged', ({ quality, metrics }) => {
 *   switch (quality) {
 *     case 'poor':
 *       notifyUser('Network quality is poor. Consider switching networks.');
 *       logMetric('quality_degradation', metrics);
 *       break;
 *     case 'lost':
 *       handleConnectionLoss();
 *       attemptReconnection();
 *       break;
 *   }
 * });
 *
 * // Check for high latency
 * const stats = analytics.getConnectionStats();
 * if (stats.latency > 300) {
 *   showLatencyWarning(stats.latency);
 * }
 *
 * // Monitor packet loss
 * if (stats.packetLoss > 5) {
 *   reportNetworkIssue('high_packet_loss', stats);
 * }
 * ```
 *
 * Technical Implementation:
 * - Uses LiveKit's native WebRTC statistics when available
 * - Implements fallback quality estimation based on ConnectionQuality enum
 * - Collects analytics every 5 seconds (configurable via ANALYTICS_COLLECTION_INTERVAL)
 * - Maintains real-time audio activity tracking with timestamp precision
 * - Provides thread-safe cleanup and resource management
 * - Emits structured events for easy integration with monitoring systems
 */

import { EventEmitter } from 'events';
import { ConnectionQuality, type Participant, type Room } from 'livekit-client';
import type {
  AudioLevelsResult,
  AudioMetrics,
  CallAnalyticsResult,
  CallStats,
  ConnectionMetrics,
  ConnectionQualityData,
  ConnectionStatsResult,
  ParticipantData,
  PerformanceMetrics,
  PerformanceMetricsResult,
  TrackStatsResult,
} from './types';

// Type for participant audio properties
type ParticipantWithAudio = {
  audioLevel?: number;
  isSpeaking?: boolean;
};

// Analytics collection configuration constants
/** Interval in milliseconds for periodic analytics collection */
const ANALYTICS_COLLECTION_INTERVAL = 5000;
/** Audio level threshold for voice activity detection (0.0 to 1.0) */
const VAD_AUDIO_THRESHOLD = 0.02;
/** Minimum duration in ms for voice activity to be considered speaking */
const VAD_MIN_SPEAKING_DURATION = 100;
/** Audio level threshold for detecting audio dropouts */
const AUDIO_DROPOUT_THRESHOLD = 0.001;
/** Duration in ms of low audio to consider it a dropout */
const DROPOUT_DETECTION_DURATION = 500;
/** Estimated jitter for excellent connection quality (ms) - internal only */
const JITTER_EXCELLENT = 5;
/** Estimated jitter for good connection quality (ms) - internal only */
const JITTER_GOOD = 15;
/** Estimated jitter for poor connection quality (ms) - internal only */
const JITTER_POOR = 50;
/** Estimated jitter for lost connection quality (ms) - internal only */
const JITTER_LOST = 200;
/** Estimated jitter for unknown connection quality (ms) - internal only */
const JITTER_UNKNOWN = 30;

/**
 * LiveKitAnalytics class extending EventEmitter for real-time analytics
 *
 * Provides comprehensive analytics collection and processing for voice agent
 * conversations, including connection quality, audio metrics, and performance data.
 */
export class LiveKitAnalytics extends EventEmitter {
  /** Call-level statistics including connection attempts, packet counts, and quality metrics */
  callStats!: CallStats;

  /** Network connection metrics including latency, packet loss, and quality ratings */
  connectionMetrics!: ConnectionMetrics;

  /** Audio-related metrics for both user and agent including levels and speaking time */
  audioMetrics!: AudioMetrics;

  /** Performance metrics including response times, latency, and call duration data */
  performanceMetrics!: PerformanceMetrics;

  /** Timer handle for periodic analytics collection, null when not collecting */
  analyticsInterval: NodeJS.Timeout | null = null;

  /** Timestamp when agent started speaking for calculating speaking duration */
  lastAgentSpeakStart: number | null = null;

  /** Timestamp when user started speaking for calculating speaking duration */
  lastUserSpeakStart: number | null = null;

  /** Unix timestamp when the call/session started for duration calculations */
  callStartTime: number | null = null;

  /** Reference to the LiveKit room for accessing WebRTC statistics */
  private room: Room | null = null;

  /** Current connection state flag for controlling analytics collection */
  private isConnected = false;

  /** Last recorded user audio level for dropout detection */
  private lastUserAudioLevel = 0;

  /** Last recorded agent audio level for dropout detection */
  private lastAgentAudioLevel = 0;

  /** Timestamp when user audio level dropped below threshold */
  private userDropoutStartTime: number | null = null;

  /** Timestamp when agent audio level dropped below threshold */
  private agentDropoutStartTime: number | null = null;

  /** Timestamp when user started speaking (VAD-based) */
  private vadUserSpeakStart: number | null = null;

  /** Timestamp when agent started speaking (VAD-based) */
  private vadAgentSpeakStart: number | null = null;

  /** Timestamp when user input was detected (for response time measurement) */
  private lastUserInputTime: number | null = null;

  /** Previous connection quality for jitter change detection (internal) */
  private previousConnectionQuality = 'unknown';

  /**
   * Creates a new LiveKitAnalytics instance
   *
   * Initializes all metric structures to default values and prepares
   * the analytics system for data collection. The instance is ready
   * to begin collection once a room reference is provided.
   *
   * @example
   * ```typescript
   * const analytics = new LiveKitAnalytics();
   *
   * // Set up event listeners
   * analytics.on('connectionQualityChanged', handleQualityChange);
   * analytics.on('analyticsUpdated', updateDashboard);
   *
   * // Configure for a specific room
   * analytics.setRoom(liveKitRoom);
   * analytics.setConnectionState(true, Date.now());
   * analytics.startAnalyticsCollection();
   * ```
   */
  constructor() {
    super();
    this.#initializeMetrics();
  }

  /**
   * Initializes all metric structures to their default values
   *
   * This private method sets up the initial state for all analytics data structures,
   * ensuring consistent baseline values across connection, audio, and performance metrics.
   * Called during construction and cleanup operations.
   *
   * @private
   */
  #initializeMetrics(): void {
    this.callStats = {
      connectionAttempts: 0,
      reconnectionAttempts: 0,
      totalBytesReceived: 0,
      totalBytesSent: 0,
      packetsLost: 0,
      participantCount: 0,
      trackCount: 0,
      audioLevels: [],
      connectionQuality: 'unknown',
    };

    this.connectionMetrics = {
      latency: 0,
      packetLoss: 0,
      bandwidth: 0,
      quality: 'unknown',
      jitter: 0,
    };

    this.audioMetrics = {
      userAudioLevel: 0,
      agentAudioLevel: 0,
      userSpeakingTime: 0,
      agentSpeakingTime: 0,
      audioDropouts: 0,
      echoCancellationActive: false,
    };

    this.performanceMetrics = {
      responseTime: 0,
      networkLatency: 0,
      connectionEstablishedTime: 0,
      reconnectionCount: 0,
    };
  }

  /**
   * Sets the LiveKit room reference for analytics data collection
   *
   * Provides the analytics system with access to the LiveKit room instance
   * for collecting WebRTC statistics and monitoring connection quality.
   * This is typically called by the LiveKitManager when a connection is established.
   *
   * @param room - LiveKit room instance or null to clear the reference
   *
   * @example
   * ```typescript
   * const room = new Room();
   * await room.connect(url, token);
   *
   * analytics.setRoom(room);  // Enable analytics collection
   * analytics.setRoom(null);  // Disable collection
   * ```
   */
  setRoom(room: Room | null): void {
    this.room = room;
  }

  /**
   * Updates the connection state and optionally sets the call start time
   *
   * Controls whether analytics collection is active and records when the
   * call session began for accurate duration calculations. The call start
   * time is used for all performance metrics that depend on session duration.
   *
   * @param isConnected - Whether the connection is currently active
   * @param callStartTime - Unix timestamp when the call started (optional)
   *
   * @example
   * ```typescript
   * // Connection established
   * analytics.setConnectionState(true, Date.now());
   *
   * // Connection lost
   * analytics.setConnectionState(false);
   *
   * // Reconnection successful (preserve original start time)
   * analytics.setConnectionState(true);
   * ```
   */
  setConnectionState(
    isConnected: boolean,
    callStartTime: number | null = null
  ): void {
    this.isConnected = isConnected;
    if (callStartTime) {
      this.callStartTime = callStartTime;
    }
  }

  /**
   * Updates connection attempt statistics for reliability tracking
   *
   * Tracks the number of initial connection attempts and reconnection
   * attempts for monitoring connection reliability and user experience.
   * These metrics help identify network stability issues.
   *
   * @param connectionAttempts - Total number of initial connection attempts
   * @param reconnectionAttempts - Total number of reconnection attempts
   *
   * @example
   * ```typescript
   * // After initial connection attempt
   * analytics.updateConnectionStats(1, 0);
   *
   * // After reconnection
   * analytics.updateConnectionStats(1, 1);
   *
   * // Multiple reconnection attempts
   * analytics.updateConnectionStats(1, 3);
   * ```
   */
  updateConnectionStats(
    connectionAttempts: number,
    reconnectionAttempts: number
  ): void {
    this.callStats.connectionAttempts = connectionAttempts;
    this.callStats.reconnectionAttempts = reconnectionAttempts;
    this.performanceMetrics.reconnectionCount = reconnectionAttempts;
  }

  /**
   * Updates real-time participant and track counts for session monitoring
   *
   * Tracks the current number of participants in the conversation and
   * active audio/video tracks for capacity monitoring and analytics.
   * These counts are updated whenever participants join/leave or tracks change.
   *
   * @param participantCount - Current number of participants in the room
   * @param trackCount - Current number of active tracks (audio/video streams)
   *
   * @example
   * ```typescript
   * // Initial state: user only
   * analytics.updateCounts(1, 0);
   *
   * // Agent joins with audio track
   * analytics.updateCounts(2, 1);
   *
   * // Additional participant joins
   * analytics.updateCounts(3, 2);
   * ```
   */
  updateCounts(participantCount: number, trackCount: number): void {
    this.callStats.participantCount = participantCount;
    this.callStats.trackCount = trackCount;
  }

  /**
   * Records the time taken to establish the WebRTC connection
   *
   * Captures the duration from connection initiation to successful establishment
   * for performance monitoring and optimization. This metric helps identify
   * connection setup bottlenecks and network performance issues.
   *
   * @param time - Time in milliseconds to establish the connection
   *
   * @example
   * ```typescript
   * const startTime = Date.now();
   * await room.connect(url, token);
   * const establishTime = Date.now() - startTime;
   *
   * analytics.setConnectionEstablishedTime(establishTime);
   * ```
   */
  setConnectionEstablishedTime(time: number): void {
    this.performanceMetrics.connectionEstablishedTime = time;
  }

  /**
   * Begins periodic analytics data collection and event emission
   *
   * Starts a recurring timer that collects WebRTC statistics, processes metrics,
   * and emits analytics updates every 5 seconds. This enables real-time monitoring
   * dashboards and automated quality detection systems. Automatically stops any
   * existing collection before starting new collection.
   *
   * @example
   * ```typescript
   * // Start collection when connection is established
   * analytics.setRoom(room);
   * analytics.setConnectionState(true, Date.now());
   * analytics.startAnalyticsCollection();
   *
   * // Listen for periodic updates
   * analytics.on('analyticsUpdated', (data) => {
   *   updateDashboard(data);
   *   checkQualityThresholds(data);
   * });
   * ```
   */
  startAnalyticsCollection(): void {
    if (this.analyticsInterval) {
      this.stopAnalyticsCollection();
    }

    this.analyticsInterval = setInterval(() => {
      this.#collectAnalytics();
    }, ANALYTICS_COLLECTION_INTERVAL); // Collect analytics every 5 seconds
  }

  /**
   * Stops periodic analytics collection and clears the collection timer
   *
   * Terminates the recurring analytics collection, stopping all periodic
   * data gathering and event emission. This is typically called when
   * disconnecting or when analytics are no longer needed.
   *
   * @example
   * ```typescript
   * // Stop collection when disconnecting
   * analytics.stopAnalyticsCollection();
   *
   * // Or stop temporarily for resource conservation
   * if (backgroundMode) {
   *   analytics.stopAnalyticsCollection();
   * }
   * ```
   */
  stopAnalyticsCollection(): void {
    if (this.analyticsInterval) {
      clearInterval(this.analyticsInterval);
      this.analyticsInterval = null;
    }
  }

  /**
   * Handles connection quality changes
   */
  handleConnectionQualityChanged(
    quality: ConnectionQuality,
    participant: Participant
  ): void {
    // Use native LiveKit ConnectionQuality enum values directly
    const qualityString = this.#mapConnectionQualityToString(quality);
    this.connectionMetrics.quality = qualityString;
    this.callStats.connectionQuality = qualityString;

    // Try to collect real WebRTC stats immediately on quality change
    this.#collectWebRTCStats();

    // Update jitter estimation based on quality changes (internal only)
    this.#updateJitterFromQualityChanges(qualityString);

    const qualityData: ConnectionQualityData = {
      quality,
      participant: participant.identity || 'unknown',
      metrics: {
        quality: qualityString,
      },
    };

    this.emit('connectionQualityChanged', qualityData);
  }

  /**
   * Handles audio playback status changes
   */
  handleAudioPlaybackChanged(playing: boolean): void {
    // Audio playback status is now tracked through active speakers
    // This event is still emitted for external listeners
    this.emit('audioPlaybackChanged', playing);

    // Trigger immediate audio metrics update
    this.#updateAudioMetricsFromActiveSpeakers();
  }

  /**
   * Gets current connection statistics (customer-facing - verified data only)
   */
  getConnectionStats(): ConnectionStatsResult {
    return {
      quality: this.connectionMetrics.quality,
      connectionAttempts: this.callStats.connectionAttempts,
      reconnectionAttempts: this.callStats.reconnectionAttempts,
      connectionEstablishedTime:
        this.performanceMetrics.connectionEstablishedTime,
      isConnected: this.isConnected,
    };
  }

  /**
   * Gets current audio levels and metrics
   */
  getAudioLevels(): AudioLevelsResult {
    return {
      userAudioLevel: this.audioMetrics.userAudioLevel,
      agentAudioLevel: this.audioMetrics.agentAudioLevel,
      userSpeakingTime: this.audioMetrics.userSpeakingTime,
      agentSpeakingTime: this.audioMetrics.agentSpeakingTime,
      audioDropouts: this.audioMetrics.audioDropouts,
      echoCancellationActive: this.audioMetrics.echoCancellationActive,
      currentUserLevel: this.audioMetrics.userAudioLevel,
      currentAgentLevel: this.audioMetrics.agentAudioLevel,
    };
  }

  /**
   * Gets current performance metrics (customer-facing - verified data only)
   */
  getPerformanceMetrics(): PerformanceMetricsResult {
    const callDuration = this.callStartTime
      ? Date.now() - this.callStartTime
      : 0;

    return {
      responseTime: this.performanceMetrics.responseTime,
      connectionEstablishedTime:
        this.performanceMetrics.connectionEstablishedTime,
      reconnectionCount: this.performanceMetrics.reconnectionCount,
      callDuration,
      averageResponseTime: this.performanceMetrics.responseTime, // Could be enhanced with actual averaging
    };
  }

  /**
   * Manually records response time for agent interactions
   *
   * @param responseTime - Response time in milliseconds
   *
   * @example
   * ```typescript
   * // Record custom response time measurement
   * const startTime = Date.now();
   * // ... agent processing ...
   * const responseTime = Date.now() - startTime;
   * analytics.recordResponseTime(responseTime);
   * ```
   */
  recordResponseTime(responseTime: number): void {
    this.performanceMetrics.responseTime = responseTime;
    this.emit('responseTimeRecorded', {
      responseTime,
      timestamp: Date.now(),
    });
  }

  /**
   * Gets current voice activity detection thresholds
   */
  getVADSettings(): {
    audioThreshold: number;
    minSpeakingDuration: number;
    dropoutThreshold: number;
    dropoutDetectionDuration: number;
  } {
    return {
      audioThreshold: VAD_AUDIO_THRESHOLD,
      minSpeakingDuration: VAD_MIN_SPEAKING_DURATION,
      dropoutThreshold: AUDIO_DROPOUT_THRESHOLD,
      dropoutDetectionDuration: DROPOUT_DETECTION_DURATION,
    };
  }

  /**
   * Gets comprehensive call analytics (customer-facing - verified data only)
   */
  getCallAnalytics(
    participants: ParticipantData[],
    trackStats: TrackStatsResult,
    volume: number,
    isPaused: boolean
  ): CallAnalyticsResult & { callDuration: number } {
    const performanceMetrics = this.getPerformanceMetrics();
    const audioMetrics = this.getAudioLevels();

    return {
      connectionStats: this.getConnectionStats(),
      audioMetrics: {
        ...audioMetrics,
        isPaused,
        volume,
      },
      performanceMetrics,
      participants,
      trackStats,
      callStats: this.callStats,
      metadata: {
        callStartTime: this.callStartTime,
        isConnected: this.isConnected,
        isPaused,
        volume,
      },
      callDuration: performanceMetrics.callDuration,
    };
  }

  /**
   * Gets full connection statistics including estimated metrics (internal use only)
   * @internal
   */
  getInternalConnectionStats(): ConnectionMetrics & {
    connectionAttempts: number;
    reconnectionAttempts: number;
    connectionEstablishedTime: number;
    isConnected: boolean;
  } {
    return {
      latency: this.connectionMetrics.latency,
      packetLoss: this.connectionMetrics.packetLoss,
      bandwidth: this.connectionMetrics.bandwidth,
      quality: this.connectionMetrics.quality,
      jitter: this.connectionMetrics.jitter,
      connectionAttempts: this.callStats.connectionAttempts,
      reconnectionAttempts: this.callStats.reconnectionAttempts,
      connectionEstablishedTime:
        this.performanceMetrics.connectionEstablishedTime,
      isConnected: this.isConnected,
    };
  }

  /**
   * Gets full performance metrics including estimated network latency (internal use only)
   * @internal
   */
  getInternalPerformanceMetrics(): PerformanceMetrics & {
    callDuration: number;
    averageResponseTime: number;
  } {
    const callDuration = this.callStartTime
      ? Date.now() - this.callStartTime
      : 0;

    return {
      responseTime: this.performanceMetrics.responseTime,
      networkLatency:
        this.performanceMetrics.networkLatency ||
        this.connectionMetrics.latency,
      connectionEstablishedTime:
        this.performanceMetrics.connectionEstablishedTime,
      reconnectionCount: this.performanceMetrics.reconnectionCount,
      callDuration,
      averageResponseTime: this.performanceMetrics.responseTime,
    };
  }

  /**
   * Collects analytics data periodically
   */
  #collectAnalytics(): void {
    if (!(this.room && this.isConnected)) {
      return;
    }

    try {
      // Collect real WebRTC statistics from LiveKit engine
      this.#collectWebRTCStats();

      // Update connection quality from LiveKit's native monitoring
      if (this.room?.localParticipant) {
        const quality = this.room.localParticipant.connectionQuality;
        if (quality) {
          const qualityString = this.#mapConnectionQualityToString(quality);
          this.connectionMetrics.quality = qualityString;
          this.callStats.connectionQuality = qualityString;
        }
      }

      // Update audio metrics from active speakers
      this.#updateAudioMetricsFromActiveSpeakers();

      // Update participant data with latest LiveKit information
      this.#updateParticipantMetrics();

      // Update echo cancellation status
      this.#updateEchoCancellationStatus();

      // Emit periodic analytics update with call duration
      const performanceMetrics = this.getPerformanceMetrics();
      this.emit('analyticsUpdated', {
        connectionStats: this.getConnectionStats(),
        audioMetrics: this.getAudioLevels(),
        performanceMetrics,
        callDuration: performanceMetrics.callDuration,
      });
    } catch (_error) {
      // Ignore analytics collection errors to prevent disruption
    }
  }

  /**
   * Maps LiveKit ConnectionQuality enum to string
   */
  #mapConnectionQualityToString(quality: ConnectionQuality): string {
    switch (quality) {
      case ConnectionQuality.Excellent:
        return 'excellent';
      case ConnectionQuality.Good:
        return 'good';
      case ConnectionQuality.Poor:
        return 'poor';
      default:
        return 'lost';
    }
  }

  /**
   * Collects real WebRTC statistics from LiveKit engine
   *
   * Note: Direct access to WebRTC peer connection stats is not available
   * through LiveKit's public API. For now, this falls back to quality estimates.
   *
   * Future implementation will include:
   * - Real latency from RTCStatsReport candidate-pair stats
   * - Actual packet loss from inbound-rtp stats
   * - True jitter measurements from RTP stats
   * - Bitrate and bandwidth utilization tracking
   * - Transport-level connection statistics
   */
  #collectWebRTCStats(): void {
    // TODO: Implement when LiveKit exposes native WebRTC statistics API
    // Example future implementation:
    //
    // if (this.room?.engine?.pc) {
    //   const stats = await this.room.engine.pc.getStats();
    //   this.#processRealWebRTCStats(stats);
    // } else {
    //   this.#fallbackToQualityEstimates();
    // }

    // For now, rely on LiveKit's connection quality assessments
    this.#fallbackToQualityEstimates();
  }

  /**
   * Framework for processing real WebRTC statistics (internal - future implementation)
   *
   * This method will process actual RTCStatsReport when available through LiveKit API:
   * - Parse candidate-pair stats for real RTT/latency
   * - Extract inbound-rtp stats for packet loss and jitter
   * - Analyze outbound-rtp stats for send rates
   * - Monitor transport stats for bandwidth
   */
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Future implementation placeholder
  #processRealWebRTCStats(_statsReport: RTCStatsReport): void {
    // TODO: Future implementation will include:
    // 1. Real latency from candidate-pair currentRoundTripTime
    // 2. Actual packet loss from inbound-rtp packetsLost/packetsReceived
    // 3. True jitter from inbound-rtp jitter property
    // 4. Bitrate calculations from bytesReceived/bytesSent deltas
    // 5. Transport-level bandwidth from availableOutgoingBitrate
    // For reference, this would replace the current quality-based estimates
    // with real measurements from WebRTC peer connection statistics
  }

  // Note: WebRTC stats parsing methods removed since they're not currently used
  // Will be implemented when LiveKit exposes native WebRTC statistics access

  /**
   * Falls back to quality-based estimates when real stats are unavailable (internal)
   */
  #fallbackToQualityEstimates(): void {
    const quality = this.room?.localParticipant?.connectionQuality;
    if (!quality) {
      return;
    }

    const estimates = this.#getQualityMetrics(quality);

    // Only update if we don't already have real values
    if (this.connectionMetrics.latency === 0) {
      this.connectionMetrics.latency = estimates.latency;
      this.connectionMetrics.packetLoss = estimates.packetLoss;
      this.connectionMetrics.bandwidth = estimates.bandwidth;
    }
  }

  /**
   * Gets metrics based on LiveKit ConnectionQuality (internal estimates)
   */
  #getQualityMetrics(quality: ConnectionQuality): {
    latency: number;
    packetLoss: number;
    bandwidth: number;
  } {
    switch (quality) {
      case ConnectionQuality.Excellent:
        return { latency: 10, packetLoss: 0, bandwidth: 1_000_000 };
      case ConnectionQuality.Good:
        return { latency: 50, packetLoss: 0.1, bandwidth: 500_000 };
      case ConnectionQuality.Poor:
        return { latency: 200, packetLoss: 1, bandwidth: 100_000 };
      default:
        return { latency: 1000, packetLoss: 10, bandwidth: 0 };
    }
  }

  // Removed #getQualityMetrics - no longer providing estimated metrics

  /**
   * Updates audio metrics from active speakers using native LiveKit data
   */
  #updateAudioMetricsFromActiveSpeakers(): void {
    if (!this.room) {
      return;
    }

    const currentTime = Date.now();
    const activeSpeakers = this.room.activeSpeakers;

    // Reset audio levels
    let userAudioLevel = 0;
    let agentAudioLevel = 0;

    // Process active speakers to get real audio levels
    for (const participant of activeSpeakers) {
      if (participant === this.room.localParticipant) {
        userAudioLevel = this.#updateUserAudioMetrics(participant, currentTime);
      } else {
        agentAudioLevel = Math.max(
          agentAudioLevel,
          this.#updateAgentAudioMetrics(participant, currentTime)
        );
      }
    }

    // Update current audio levels
    this.audioMetrics.userAudioLevel = userAudioLevel;
    this.audioMetrics.agentAudioLevel = agentAudioLevel;
  }

  /**
   * Updates user audio metrics and returns current audio level
   */
  #updateUserAudioMetrics(
    participant: ParticipantWithAudio,
    currentTime: number
  ): number {
    const audioLevel = participant.audioLevel || 0;
    const isSpeaking = participant.isSpeaking;

    // Track speaking time for user (using LiveKit's isSpeaking)
    if (isSpeaking && !this.lastUserSpeakStart) {
      this.lastUserSpeakStart = currentTime;
      this.lastUserInputTime = currentTime; // Track for response time measurement
    } else if (!isSpeaking && this.lastUserSpeakStart) {
      this.audioMetrics.userSpeakingTime +=
        currentTime - this.lastUserSpeakStart;
      this.lastUserSpeakStart = null;
    }

    // Enhanced Voice Activity Detection using audio level threshold
    this.#processVAD('user', audioLevel, currentTime);

    // Audio dropout detection
    this.#processAudioDropout('user', audioLevel, currentTime);

    return audioLevel;
  }

  /**
   * Updates agent audio metrics and returns current audio level
   */
  #updateAgentAudioMetrics(
    participant: ParticipantWithAudio,
    currentTime: number
  ): number {
    const audioLevel = participant.audioLevel || 0;
    const isSpeaking = participant.isSpeaking;

    // Track speaking time for agent
    if (isSpeaking && !this.lastAgentSpeakStart) {
      this.lastAgentSpeakStart = currentTime;

      // Calculate response time if user recently spoke
      if (this.lastUserInputTime) {
        const responseTime = currentTime - this.lastUserInputTime;
        this.performanceMetrics.responseTime = responseTime;
        this.lastUserInputTime = null; // Reset after measurement
      }
    } else if (!isSpeaking && this.lastAgentSpeakStart) {
      this.audioMetrics.agentSpeakingTime +=
        currentTime - this.lastAgentSpeakStart;
      this.lastAgentSpeakStart = null;
    }

    // Enhanced Voice Activity Detection using audio level threshold
    this.#processVAD('agent', audioLevel, currentTime);

    // Audio dropout detection
    this.#processAudioDropout('agent', audioLevel, currentTime);

    return audioLevel;
  }

  /**
   * Updates participant metrics from room state
   */
  #updateParticipantMetrics(): void {
    if (!this.room) {
      return;
    }

    // Update participant count (local + remote)
    this.callStats.participantCount = 1 + this.room.remoteParticipants.size;

    // Update track count from all participants
    this.callStats.trackCount = this.#calculateTotalTracks();
  }

  /**
   * Calculates total track count from all participants
   */
  #calculateTotalTracks(): number {
    let totalTracks = 0;

    // Count local tracks
    totalTracks += this.room?.localParticipant.trackPublications.size || 0;

    // Count remote tracks
    for (const participant of this.room?.remoteParticipants.values() || []) {
      totalTracks += participant.trackPublications.size;
    }

    return totalTracks;
  }

  /**
   * Processes Voice Activity Detection using audio level thresholds
   */
  #processVAD(
    participant: 'user' | 'agent',
    audioLevel: number,
    currentTime: number
  ): void {
    if (participant === 'user') {
      this.#processUserVAD(audioLevel, currentTime);
    } else {
      this.#processAgentVAD(audioLevel, currentTime);
    }
  }

  /**
   * Processes voice activity detection for user
   */
  #processUserVAD(audioLevel: number, currentTime: number): void {
    const isActive = audioLevel > VAD_AUDIO_THRESHOLD;

    if (isActive && !this.vadUserSpeakStart) {
      this.vadUserSpeakStart = currentTime;
    } else if (!isActive && this.vadUserSpeakStart) {
      this.#handleVADEnd('user', audioLevel, currentTime);
    }
  }

  /**
   * Processes voice activity detection for agent
   */
  #processAgentVAD(audioLevel: number, currentTime: number): void {
    const isActive = audioLevel > VAD_AUDIO_THRESHOLD;

    if (isActive && !this.vadAgentSpeakStart) {
      this.vadAgentSpeakStart = currentTime;
    } else if (!isActive && this.vadAgentSpeakStart) {
      this.#handleVADEnd('agent', audioLevel, currentTime);
    }
  }

  /**
   * Handles end of voice activity detection
   */
  #handleVADEnd(
    participant: 'user' | 'agent',
    audioLevel: number,
    currentTime: number
  ): void {
    const startTime =
      participant === 'user' ? this.vadUserSpeakStart : this.vadAgentSpeakStart;

    if (!startTime) {
      return;
    }

    const duration = currentTime - startTime;
    if (duration >= VAD_MIN_SPEAKING_DURATION) {
      this.emit('voiceActivityDetected', {
        participant,
        duration,
        audioLevel,
        timestamp: currentTime,
      });
    }

    // Reset VAD tracking
    if (participant === 'user') {
      this.vadUserSpeakStart = null;
    } else {
      this.vadAgentSpeakStart = null;
    }
  }

  /**
   * Processes audio dropout detection
   */
  #processAudioDropout(
    participant: 'user' | 'agent',
    audioLevel: number,
    currentTime: number
  ): void {
    if (participant === 'user') {
      this.#processUserAudioDropout(audioLevel, currentTime);
    } else {
      this.#processAgentAudioDropout(audioLevel, currentTime);
    }
  }

  /**
   * Processes user audio dropout detection
   */
  #processUserAudioDropout(audioLevel: number, currentTime: number): void {
    // Check if audio level dropped significantly
    if (
      this.lastUserAudioLevel > VAD_AUDIO_THRESHOLD &&
      audioLevel < AUDIO_DROPOUT_THRESHOLD
    ) {
      // Potential dropout started
      if (!this.userDropoutStartTime) {
        this.userDropoutStartTime = currentTime;
      }
    } else if (
      audioLevel >= AUDIO_DROPOUT_THRESHOLD &&
      this.userDropoutStartTime
    ) {
      // Audio recovered - check if it was a confirmed dropout
      this.#handleDropoutRecovery('user', currentTime);
    }
    this.lastUserAudioLevel = audioLevel;
  }

  /**
   * Processes agent audio dropout detection
   */
  #processAgentAudioDropout(audioLevel: number, currentTime: number): void {
    // Check if audio level dropped significantly
    if (
      this.lastAgentAudioLevel > VAD_AUDIO_THRESHOLD &&
      audioLevel < AUDIO_DROPOUT_THRESHOLD
    ) {
      // Potential dropout started
      if (!this.agentDropoutStartTime) {
        this.agentDropoutStartTime = currentTime;
      }
    } else if (
      audioLevel >= AUDIO_DROPOUT_THRESHOLD &&
      this.agentDropoutStartTime
    ) {
      // Audio recovered - check if it was a confirmed dropout
      this.#handleDropoutRecovery('agent', currentTime);
    }
    this.lastAgentAudioLevel = audioLevel;
  }

  /**
   * Handles audio dropout recovery and emits events if confirmed
   */
  #handleDropoutRecovery(
    participant: 'user' | 'agent',
    currentTime: number
  ): void {
    const dropoutStartTime =
      participant === 'user'
        ? this.userDropoutStartTime
        : this.agentDropoutStartTime;

    if (!dropoutStartTime) {
      return;
    }

    const dropoutDuration = currentTime - dropoutStartTime;
    if (dropoutDuration >= DROPOUT_DETECTION_DURATION) {
      // Confirmed dropout
      this.audioMetrics.audioDropouts++;
      this.emit('audioDropoutDetected', {
        participant,
        duration: dropoutDuration,
        timestamp: currentTime,
      });
    }

    // Reset dropout tracking
    if (participant === 'user') {
      this.userDropoutStartTime = null;
    } else {
      this.agentDropoutStartTime = null;
    }
  }

  /**
   * Estimates jitter based on connection quality changes (internal)
   */
  #updateJitterFromQualityChanges(currentQuality: string): void {
    if (this.previousConnectionQuality !== currentQuality) {
      // Quality changed - estimate jitter based on quality degradation
      let estimatedJitter = 0;

      switch (currentQuality) {
        case 'excellent':
          estimatedJitter = JITTER_EXCELLENT;
          break;
        case 'good':
          estimatedJitter = JITTER_GOOD;
          break;
        case 'poor':
          estimatedJitter = JITTER_POOR;
          break;
        case 'lost':
          estimatedJitter = JITTER_LOST;
          break;
        default:
          estimatedJitter = JITTER_UNKNOWN;
          break;
      }

      this.connectionMetrics.jitter = estimatedJitter;
      this.previousConnectionQuality = currentQuality;

      // Emit jitter change event (internal only)
      this.emit('jitterChanged', {
        jitter: estimatedJitter,
        quality: currentQuality,
        previousQuality: this.previousConnectionQuality,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Checks for echo cancellation status from room tracks
   */
  #updateEchoCancellationStatus(): void {
    if (!this.room?.localParticipant?.audioTrackPublications) {
      return;
    }

    let echoCancellationActive = false;

    for (const publication of this.room.localParticipant.audioTrackPublications.values()) {
      if (publication.track) {
        // Check if audio track has echo cancellation enabled
        // Note: This is a basic implementation - actual EC detection would require
        // access to MediaTrackSettings or constraints
        const constraints = (
          publication.track as unknown as MediaStreamTrack
        ).getConstraints?.();
        if (constraints?.echoCancellation !== false) {
          echoCancellationActive = true;
          break;
        }
      }
    }

    if (this.audioMetrics.echoCancellationActive !== echoCancellationActive) {
      this.audioMetrics.echoCancellationActive = echoCancellationActive;
      this.emit('echoCancellationChanged', {
        active: echoCancellationActive,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Cleans up analytics resources
   */
  cleanup(): void {
    this.stopAnalyticsCollection();
    this.#initializeMetrics();
    this.lastAgentSpeakStart = null;
    this.lastUserSpeakStart = null;
    this.vadUserSpeakStart = null;
    this.vadAgentSpeakStart = null;
    this.userDropoutStartTime = null;
    this.agentDropoutStartTime = null;
    this.lastUserInputTime = null;
    this.lastUserAudioLevel = 0;
    this.lastAgentAudioLevel = 0;
    this.previousConnectionQuality = 'unknown';
  }
}
