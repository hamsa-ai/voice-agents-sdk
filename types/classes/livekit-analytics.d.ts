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
import type { AudioLevelsResult, AudioMetrics, CallAnalyticsResult, CallStats, ConnectionMetrics, ConnectionStatsResult, ParticipantData, PerformanceMetrics, PerformanceMetricsResult, TrackStatsResult } from './types';
/**
 * LiveKitAnalytics class extending EventEmitter for real-time analytics
 *
 * Provides comprehensive analytics collection and processing for voice agent
 * conversations, including connection quality, audio metrics, and performance data.
 */
export declare class LiveKitAnalytics extends EventEmitter {
    #private;
    /** Call-level statistics including connection attempts, packet counts, and quality metrics */
    callStats: CallStats;
    /** Network connection metrics including latency, packet loss, and quality ratings */
    connectionMetrics: ConnectionMetrics;
    /** Audio-related metrics for both user and agent including levels and speaking time */
    audioMetrics: AudioMetrics;
    /** Performance metrics including response times, latency, and call duration data */
    performanceMetrics: PerformanceMetrics;
    /** Timer handle for periodic analytics collection, null when not collecting */
    analyticsInterval: NodeJS.Timeout | null;
    /** Timestamp when agent started speaking for calculating speaking duration */
    lastAgentSpeakStart: number | null;
    /** Timestamp when user started speaking for calculating speaking duration */
    lastUserSpeakStart: number | null;
    /** Unix timestamp when the call/session started for duration calculations */
    callStartTime: number | null;
    /** Reference to the LiveKit room for accessing WebRTC statistics */
    private room;
    /** Current connection state flag for controlling analytics collection */
    private isConnected;
    /** Last recorded user audio level for dropout detection */
    private lastUserAudioLevel;
    /** Last recorded agent audio level for dropout detection */
    private lastAgentAudioLevel;
    /** Timestamp when user audio level dropped below threshold */
    private userDropoutStartTime;
    /** Timestamp when agent audio level dropped below threshold */
    private agentDropoutStartTime;
    /** Timestamp when user started speaking (VAD-based) */
    private vadUserSpeakStart;
    /** Timestamp when agent started speaking (VAD-based) */
    private vadAgentSpeakStart;
    /** Timestamp when user input was detected (for response time measurement) */
    private lastUserInputTime;
    /** Previous connection quality for jitter change detection (internal) */
    private previousConnectionQuality;
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
    constructor();
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
    setRoom(room: Room | null): void;
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
    setConnectionState(isConnected: boolean, callStartTime?: number | null): void;
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
    updateConnectionStats(connectionAttempts: number, reconnectionAttempts: number): void;
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
    updateCounts(participantCount: number, trackCount: number): void;
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
    setConnectionEstablishedTime(time: number): void;
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
    startAnalyticsCollection(): void;
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
    stopAnalyticsCollection(): void;
    /**
     * Handles connection quality changes
     */
    handleConnectionQualityChanged(quality: ConnectionQuality, participant: Participant): void;
    /**
     * Handles audio playback status changes
     */
    handleAudioPlaybackChanged(playing: boolean): void;
    /**
     * Gets current connection statistics (customer-facing - verified data only)
     */
    getConnectionStats(): ConnectionStatsResult;
    /**
     * Gets current audio levels and metrics
     */
    getAudioLevels(): AudioLevelsResult;
    /**
     * Gets current performance metrics (customer-facing - verified data only)
     */
    getPerformanceMetrics(): PerformanceMetricsResult;
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
    recordResponseTime(responseTime: number): void;
    /**
     * Gets current voice activity detection thresholds
     */
    getVADSettings(): {
        audioThreshold: number;
        minSpeakingDuration: number;
        dropoutThreshold: number;
        dropoutDetectionDuration: number;
    };
    /**
     * Gets comprehensive call analytics (customer-facing - verified data only)
     */
    getCallAnalytics(participants: ParticipantData[], trackStats: TrackStatsResult, volume: number, isPaused: boolean): CallAnalyticsResult & {
        callDuration: number;
    };
    /**
     * Gets full connection statistics including estimated metrics (internal use only)
     * @internal
     */
    getInternalConnectionStats(): ConnectionMetrics & {
        connectionAttempts: number;
        reconnectionAttempts: number;
        connectionEstablishedTime: number;
        isConnected: boolean;
    };
    /**
     * Gets full performance metrics including estimated network latency (internal use only)
     * @internal
     */
    getInternalPerformanceMetrics(): PerformanceMetrics & {
        callDuration: number;
        averageResponseTime: number;
    };
    /**
     * Cleans up analytics resources
     */
    cleanup(): void;
}
