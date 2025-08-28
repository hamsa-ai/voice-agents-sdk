/**
 * Shared types and interfaces for LiveKit modules
 */
import type {
  ConnectionQuality,
  RemoteTrack,
  RemoteTrackPublication,
} from 'livekit-client';

/**
 * Function signature for client-side tools that can be executed by the agent.
 * Tools can be synchronous or asynchronous and accept variable arguments.
 */
export type ToolFunction = (...args: unknown[]) => unknown | Promise<unknown>;

/**
 * Definition for a client-side tool that can be registered with the voice agent.
 * These tools are made available to the agent as RPC methods during conversations.
 */
export type Tool = {
  /** The name of the function that the agent can call */
  function_name: string;
  /** The implementation function to execute when the agent calls this tool */
  fn?: ToolFunction;
};

/**
 * Represents an audio level measurement at a specific point in time.
 * Used for tracking audio activity and volume levels during calls.
 */
export type AudioLevel = {
  /** Unix timestamp when the audio level was measured */
  timestamp: number;
  /** Audio level value (typically 0.0 to 1.0) */
  level: number;
  /** Optional identifier of the participant this audio level belongs to */
  participant?: string;
};

/**
 * Information about a participant in the voice conversation.
 * Contains connection details and metadata for analytics and monitoring.
 */
export type ParticipantData = {
  /** Unique identity of the participant (e.g., 'agent', 'user') */
  identity: string;
  /** Session ID assigned by LiveKit for this participant */
  sid: string;
  /** Unix timestamp when the participant connected */
  connectionTime: number;
  /** Optional metadata associated with the participant */
  metadata?: string;
};

/**
 * Statistics and metadata for a media track (audio/video stream).
 * Tracks the lifecycle and details of each media stream in the conversation.
 */
export type TrackStatsData = {
  /** Unique identifier for this track */
  trackId: string;
  /** Type of track (e.g., 'audio', 'video') */
  kind: string;
  /** Identity of the participant who owns this track */
  participant: string;
  /** Unix timestamp when this track was subscribed to */
  subscriptionTime: number;
  /** LiveKit track publication object containing track details */
  publication: RemoteTrackPublication;
  /** Track source (microphone, screen_share, etc.) */
  source?: string;
  /** Whether the track is currently muted */
  muted?: boolean;
  /** Whether the track is enabled */
  enabled?: boolean;
  /** Track dimensions for video tracks */
  dimensions?: { width: number; height: number };
  /** Whether the track uses simulcast */
  simulcasted?: boolean;
};

/**
 * Comprehensive call statistics for monitoring connection health and usage.
 * Tracks network metrics, participant counts, and overall call quality.
 */
export type CallStats = {
  /** Number of connection attempts made during this session */
  connectionAttempts: number;
  /** Number of reconnection attempts due to network issues */
  reconnectionAttempts: number;
  /** Total bytes received during the call */
  totalBytesReceived: number;
  /** Total bytes sent during the call */
  totalBytesSent: number;
  /** Number of network packets lost */
  packetsLost: number;
  /** Current number of participants in the conversation */
  participantCount: number;
  /** Current number of active media tracks */
  trackCount: number;
  /** Historical audio level measurements */
  audioLevels: AudioLevel[];
  /** Current overall connection quality assessment */
  connectionQuality: string;
};

/**
 * Real-time network connection quality metrics.
 * Provides detailed information about network performance and reliability.
 */
export type ConnectionMetrics = {
  /** Current network latency in milliseconds */
  latency: number;
  /** Packet loss percentage (0.0 to 100.0) */
  packetLoss: number;
  /** Current bandwidth usage in bytes per second */
  bandwidth: number;
  /** Qualitative assessment of connection ('excellent', 'good', 'poor', 'lost') */
  quality: string;
  /** Network jitter measurement in milliseconds */
  jitter: number;
};

/**
 * Audio quality and usage metrics for both user and agent.
 * Tracks speaking patterns, audio levels, and quality indicators.
 */
export type AudioMetrics = {
  /** Current audio input level from the user (0.0 to 1.0) */
  userAudioLevel: number;
  /** Current audio output level from the agent (0.0 to 1.0) */
  agentAudioLevel: number;
  /** Total time in milliseconds the user has been speaking */
  userSpeakingTime: number;
  /** Total time in milliseconds the agent has been speaking */
  agentSpeakingTime: number;
  /** Number of audio interruptions or dropouts detected */
  audioDropouts: number;
  /** Whether echo cancellation is currently active */
  echoCancellationActive: boolean;
};

/**
 * Performance metrics tracking response times and connection reliability.
 * Measures various aspects of system and network performance.
 */
export type PerformanceMetrics = {
  /** Total response time for agent interactions in milliseconds */
  responseTime: number;
  /** Current network latency measurement in milliseconds */
  networkLatency: number;
  /** Time taken to establish the initial connection in milliseconds */
  connectionEstablishedTime: number;
  /** Total number of reconnections that have occurred */
  reconnectionCount: number;
};

/**
 * Complete connection statistics result returned by getConnectionStats().
 * Combines real-time metrics with historical connection data.
 */
export type ConnectionStatsResult = {
  /** Current network latency in milliseconds */
  latency: number;
  /** Current packet loss percentage */
  packetLoss: number;
  /** Current bandwidth usage in bytes per second */
  bandwidth: number;
  /** Current connection quality assessment */
  quality: string;
  /** Current network jitter in milliseconds */
  jitter: number;
  /** Total connection attempts made */
  connectionAttempts: number;
  /** Total reconnection attempts made */
  reconnectionAttempts: number;
  /** Time taken to establish connection in milliseconds */
  connectionEstablishedTime: number;
  /** Whether currently connected to the voice agent */
  isConnected: boolean;
};

/**
 * Complete audio metrics result returned by getAudioLevels().
 * Provides comprehensive audio quality and usage information.
 */
export type AudioLevelsResult = {
  /** User's audio input level (0.0 to 1.0) */
  userAudioLevel: number;
  /** Agent's audio output level (0.0 to 1.0) */
  agentAudioLevel: number;
  /** Total user speaking time in milliseconds */
  userSpeakingTime: number;
  /** Total agent speaking time in milliseconds */
  agentSpeakingTime: number;
  /** Number of audio dropouts detected */
  audioDropouts: number;
  /** Whether echo cancellation is active */
  echoCancellationActive: boolean;
  /** Current real-time user audio level */
  currentUserLevel: number;
  /** Current real-time agent audio level */
  currentAgentLevel: number;
  /** Whether audio is currently paused */
  isPaused?: boolean;
  /** Current volume level */
  volume?: number;
};

/**
 * Complete performance metrics result returned by getPerformanceMetrics().
 * Provides comprehensive system and network performance data.
 */
export type PerformanceMetricsResult = {
  /** Total response time in milliseconds */
  responseTime: number;
  /** Current network latency in milliseconds */
  networkLatency: number;
  /** Connection establishment time in milliseconds */
  connectionEstablishedTime: number;
  /** Total reconnection count */
  reconnectionCount: number;
  /** Total call duration in milliseconds */
  callDuration: number;
  /** Average response time in milliseconds */
  averageResponseTime: number;
};

/**
 * Complete track statistics result returned by getTrackStats().
 * Provides comprehensive track information and analytics.
 */
export type TrackStatsResult = {
  /** Total number of tracks ever created */
  totalTracks: number;
  /** Current number of active tracks */
  activeTracks: number;
  /** Number of audio elements currently active */
  audioElements: number;
  /** Detailed track statistics as [trackId, trackData] pairs */
  trackDetails: [string, TrackStatsData][];
};

/**
 * Complete analytics result returned by getCallAnalytics().
 * Combines all analytics data into a comprehensive report.
 */
export type CallAnalyticsResult = {
  /** Connection statistics and quality metrics */
  connectionStats: ConnectionStatsResult;
  /** Audio quality and usage metrics */
  audioMetrics: AudioLevelsResult;
  /** Performance metrics and timings */
  performanceMetrics: PerformanceMetricsResult;
  /** Current participant information */
  participants: ParticipantData[];
  /** Track statistics and details */
  trackStats: TrackStatsResult;
  /** Raw call statistics */
  callStats: CallStats;
  /** Additional metadata */
  metadata: {
    /** Call start time */
    callStartTime: number | null;
    /** Whether currently connected */
    isConnected: boolean;
    /** Whether call is paused */
    isPaused: boolean;
    /** Current volume level */
    volume: number;
  };
};

/**
 * Data structure for connection quality change events.
 * Provides detailed information about network conditions and performance.
 */
export type ConnectionQualityData = {
  /** Current connection quality level */
  quality: ConnectionQuality;
  /** Identity of the participant this quality measurement applies to */
  participant: string;
  /** Detailed connection metrics including latency, packet loss, etc. */
  metrics: {
    latency: number;
    packetLoss: number;
    quality: string;
  };
};

/**
 * Data structure for track subscription events.
 * Contains information about newly available audio/video streams.
 */
export type TrackSubscriptionData = {
  /** The LiveKit track object that was subscribed to */
  track: RemoteTrack;
  /** The track publication containing metadata */
  publication: RemoteTrackPublication;
  /** Identity of the participant who owns this track */
  participant: string;
  /** Optional statistics about this track subscription */
  trackStats?: TrackStatsData;
};

/**
 * Data structure for track unsubscription events.
 * Contains information about audio/video streams that are no longer available.
 */
export type TrackUnsubscriptionData = {
  /** The LiveKit track object that was unsubscribed from */
  track: RemoteTrack;
  /** The track publication that was removed */
  publication: RemoteTrackPublication;
  /** Identity of the participant who owned this track */
  participant: string;
};

/** Minimal WebAudio types (kept lightweight for cross-env compatibility) */
export type MinimalAnalyser = {
  fftSize: number;
  frequencyBinCount: number;
  getByteFrequencyData(dataArray: Uint8Array): void;
};

export type MinimalAudioNode = {
  connect?(destination: unknown): void;
};

export type MinimalAudioContext = {
  createAnalyser(): MinimalAnalyser;
  createMediaElementSource(element: HTMLAudioElement): MinimalAudioNode;
  createMediaStreamSource(stream: MediaStream): MinimalAudioNode;
};

/**
 * Metadata provided with custom events from voice agents.
 * Contains contextual information about when and from whom the event originated.
 */
export type CustomEventMetadata = {
  /** Unix timestamp when the event was generated */
  timestamp: number;
  /** Identity of the participant who triggered the event */
  participant: string;
  /** The original raw message data from LiveKit */
  rawMessage: Record<string, unknown>;
};

/**
 * LiveKit access token payload structure used by Hamsa backend.
 * Represents the decoded JWT payload fields relevant for SDK logic.
 */
export type LiveKitTokenPayload = {
  video: {
    room: string;
    roomJoin: boolean;
    canPublish: boolean;
    canPublishData: boolean;
    canSubscribe: boolean;
  };
  roomConfig: {
    name: string;
    emptyTimeout: number;
    departureTimeout: number;
    maxParticipants: number;
    minPlayoutDelay: number;
    maxPlayoutDelay: number;
    syncStreams: boolean;
    agents: Array<{
      agentName: string;
      /** JSON string containing jobId, voiceAgentId, apiKey */
      metadata: string;
    }>;
  };
  iss: string;
  exp: number;
  nbf: number;
  sub: string;
};

/**
 * Parsed metadata embedded as a JSON string in LiveKit token payload.
 */
export type LiveKitAgentMetadata = {
  jobId: string;
  voiceAgentId: string;
  apiKey: string;
};
