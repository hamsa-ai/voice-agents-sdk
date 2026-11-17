import { EventEmitter } from 'events';
import { jwtDecode } from 'jwt-decode';
import type {
  ConnectionState,
  LocalTrack,
  LocalTrackPublication,
  Participant,
  RemoteParticipant,
  RemoteTrack,
  Room,
} from 'livekit-client';
import LiveKitManager, {
  type AgentState,
  type AudioLevelsResult,
  type CallAnalyticsResult,
  type ConnectionStatsResult,
  type ParticipantData,
  type PerformanceMetricsResult,
  type TrackStatsResult,
} from './classes/livekit-manager';
import { LIVEKIT_CHAT_TOPIC } from './classes/livekit-tool-registry';
import ScreenWakeLock from './classes/screen-wake-lock';
import type {
  AudioCaptureCallback,
  AudioCaptureOptions,
  ConnectionQualityData,
  DTMFDigit,
  LiveKitTokenPayload,
  ReceivedMessage,
  TrackSubscriptionData,
  TrackUnsubscriptionData,
} from './classes/types';
import { createDebugLogger, type DebugLogger } from './utils';

export type { RpcInvocationData } from 'livekit-client';
// biome-ignore lint/performance/noBarrelFile: This is the main SDK entry point - re-exports are intentional for developer convenience
export { RpcError } from 'livekit-client';
// Re-export types for convenience
export type { AgentState } from './classes/livekit-manager';
export type {
  AudioCaptureCallback,
  AudioCaptureFormat,
  AudioCaptureMetadata,
  AudioCaptureOptions,
  AudioCaptureSource,
  DTMFDigit,
  MessageRole,
  ReceivedMessage,
} from './classes/types';

/**
 * Custom error class that includes both human-readable message and machine-readable messageKey
 * for internationalization and programmatic error handling
 */
class HamsaApiError extends Error {
  /** Machine-readable error key for i18n or programmatic handling */
  readonly messageKey?: string;
  /** The HTTP status the API answered with, when the error came from it. */
  readonly status?: number;
  /**
   * Details the API sent with the error, for example `{ environment: 'staging' }`
   * with `EnvironmentNotDeployed`.
   */
  readonly params?: Record<string, unknown>;
  /** Seconds to wait before trying again, with `ApiKeyRateLimited`. */
  readonly retryAfter?: number;

  constructor(
    message: string,
    messageKey?: string,
    details: {
      status?: number;
      params?: Record<string, unknown>;
      retryAfter?: number;
    } = {}
  ) {
    super(message);
    this.name = 'HamsaApiError';
    this.messageKey = messageKey;
    this.status = details.status;
    this.params = details.params;
    this.retryAfter = details.retryAfter;
  }
}

/** The longest `callerKey` the backend accepts. */
const MAX_CALLER_KEY_LENGTH = 200;

/**
 * What a refused start means (the public-key mint, or the call start that
 * redeems a token), in a sentence that says what to do. The API's own
 * message is kept for anything not listed here.
 */
function mintRefusal(
  messageKey: string | undefined,
  params: Record<string, unknown> = {},
  retryAfter?: number
): string | undefined {
  const environment =
    typeof params.environment === 'string' ? params.environment : 'its';
  switch (messageKey) {
    case 'EnvironmentNotDeployed':
      return `This public key is for ${environment}, and ${environment} runs nothing for this agent yet. Deploy a version to ${environment}, or use the key for another environment.`;
    case 'KeyNotForAgent':
      return 'This public key is limited to other agents. Allow this agent on the key, or use another key.';
    case 'ApiKeyRateLimited':
      return Number.isFinite(retryAfter)
        ? `Too many calls started with this key in a minute. Try again in ${retryAfter} seconds.`
        : 'Too many calls started with this key in a minute. Try again shortly.';
    case 'KeyRotated':
      return 'This key value was replaced by a newer one. Use the current value from the API keys page.';
    case 'PublicKeyFixedEnvironment':
      return 'A public key always runs what its own environment runs, so versionRef and environmentId cannot be used with it.';
    case 'CallTokenSessionOnly':
      return 'This key cannot start calls from a page. Use a public key (pk_…).';
    case 'CallTokenInvalid':
      return 'This call token was already used, or has expired: a token lives about 30 seconds and starts one call. Get a new one for each call.';
    case 'CallTokenRequired':
      return 'An API key cannot choose a version or an environment. Use a public key, or have your server mint a call token with a secret key.';
    default:
      return;
  }
}

/**
 * Supported deployment regions for the Hamsa platform.
 * Determines the default API and LiveKit URLs used for the connection.
 */
export type Region = 'eu' | 'uae';

/** Maps each region to its default API and LiveKit WebSocket URLs. */
const REGION_CONFIG = {
  eu: {
    API_URL: 'https://api.tryhamsa.com',
    LIVEKIT_URL: 'wss://rtc.eu.tryhamsa.com',
  },
  uae: {
    API_URL: 'https://api.uae.tryhamsa.com',
    LIVEKIT_URL: 'wss://rtc.uae.tryhamsa.com',
  },
} as const;

/**
 * Configuration options for the HamsaVoiceAgent constructor
 * Allows customization of API endpoints and other global settings
 */
type HamsaVoiceAgentConfig = {
  /**
   * Deployment region for the Hamsa platform. Determines default API and LiveKit URLs.
   * Defaults to 'eu'. Ignored when API_URL or LIVEKIT_URL are explicitly provided.
   */
  region?: Region;
  /** Base URL for the Hamsa API. Overrides the region default when provided. */
  API_URL?: string;
  /** LiveKit RTC WebSocket URL. Overrides the region default when provided. */
  LIVEKIT_URL?: string;
  /** Enable debug logging for troubleshooting. Defaults to false */
  debug?: boolean;
  /**
   * A public key (`pk_…`) from the Hamsa dashboard's API keys page.
   *
   * Safe to put in a web page or an app: it can only start calls, and only in
   * the environment it was made for (dev, staging or prod), running what that
   * environment runs with its values. With it, `start()` gets a call token
   * itself and starts the call with it; nothing else is needed.
   *
   * Never pass a secret key (`sk_…`) here, or anywhere in a page: secret keys
   * stay on your server, which mints call tokens for the page (see
   * `StartOptions.callToken`).
   */
  publicKey?: string;
};

/**
 * Configuration options for starting a voice agent conversation
 *
 * Defines the agent to use, conversation parameters, voice capabilities,
 * and client-side tools that will be available during the conversation.
 */
type ConnectionDelays = {
  /** Delay in milliseconds for Android devices */
  android?: number;
  /** Delay in milliseconds for iOS devices */
  ios?: number;
  /** Default delay in milliseconds for other devices */
  default?: number;
};

type StartOptions = {
  /** Unique identifier of the voice agent to start (from Hamsa dashboard) */
  agentId: string;
  /**
   * Which version of the agent this conversation should run.
   *
   * A published version id, or `"draft"` for the unpublished working copy.
   * Omit it to run what prod serves; the backend then behaves exactly as it
   * always has, which is why nothing is sent on the wire unless a caller asks
   * for it. (`"latest"` is no longer accepted.)
   *
   * An environment holds a published version, so naming an environment is a
   * complete answer: `prod` runs whatever is published there. Version ids are
   * the escape hatch for the rare case rather than the everyday interface.
   */
  versionRef?: string;
  /**
   * Which environment's values to resolve, overriding the one the chosen
   * version is published into.
   *
   * Absent is the normal case and means the values follow the version, which
   * is what every caller integrating this SDK wants: `versionRef: 'prod'`
   * already implies prod's values.
   *
   * This exists for one workflow. An operator testing a specific version
   * against a specific environment's values, deliberately, for their own call.
   * Reading an old version against `staging` values is a real thing to want,
   * and without this the only way to reach it is to publish something.
   *
   * There was deliberately no such option before, on the grounds that it would
   * let a call disagree with its own version. That was right while an
   * environment could not hold a version: naming one said which values to use
   * while saying nothing about which agent to run, so the two could contradict
   * each other silently. Now the default follows the version and the
   * disagreement is only ever something a human asked for.
   *
   * Affects this call alone. Nothing is persisted and no other caller is
   * touched.
   */
  environmentId?: string;
  /**
   * A short-lived call token, minted server-side, to start this call with
   * instead of a key: the token itself, or a function that gets one.
   *
   * With a secret key, your server mints the token
   * (`POST /v1/voice-agents/call-token` with `Authorization: Token sk_…`) and
   * the page asks it for one. Pass a function and the SDK calls it as the call
   * starts, so the token (which lives about 30 seconds and starts one call) is
   * fresh when it is used:
   *
   * ```js
   * agent.start({
   *   agentId,
   *   callToken: () =>
   *     fetch('/my-server/hamsa-token').then((r) => r.json()).then((d) => d.callToken),
   * });
   * ```
   *
   * The token already knows which agent, version and environment it runs, so
   * `versionRef` and `environmentId` are not sent next to it. It is sent as
   * `Authorization: CallToken <token>`. A token wins over a public key or an
   * API key given to the constructor.
   */
  callToken?: string | (() => string | Promise<string>);
  /**
   * A stable id for your end user (1 to 200 characters), so an A/B test keeps
   * them on the same version for as long as the split lasts.
   *
   * During a split, each call is assigned a version by weight. Phone callers
   * are kept on one side by their number; a web call has no number, so
   * without this every call is assigned on its own: weighted, but not sticky.
   * Use something that stays the same for the person across visits, such as
   * your own user id, and never anything secret.
   *
   * Sent once, when the call starts; the rest of the call reuses the version
   * chosen then.
   */
  callerKey?: string;
  /**
   * Optional parameters to pass to the agent for conversation customization
   * These can be referenced in agent prompts using {{parameter_name}} syntax
   * @example { userName: "John", orderNumber: "12345", userTier: "premium" }
   */
  params?: Record<string, unknown>;
  /**
   * Turns on page tools for this call: the `tools` registered here, which run
   * in the page (opening a cart, for example) rather than calling an HTTP
   * endpoint. A voice call does not need it.
   */
  voiceEnablement?: boolean;
  /**
   * Whether the conversation runs in chat-only mode (no audio media).
   * When true, the SDK requests a chat-only session from the backend via the
   * participant-token and conversation-init endpoints.
   */
  isChatOnly?: boolean;
  /** Array of client-side tools that the agent can call during conversations */
  tools?: Tool[];
  /** Optional user identifier for tracking and analytics */
  userId?: string;
  /** Force headphones usage on iOS devices when available */
  preferHeadphonesForIosDevices?: boolean;
  /** Platform-specific connection delays to prevent audio cutoff */
  connectionDelay?: ConnectionDelays;
  /** Disable wake lock to allow device sleep during conversation */
  disableWakeLock?: boolean;
  /**
   * CSS selector for the container element where the avatar video will be rendered.
   * When provided, the agent's video track (avatar) will be attached to this element.
   * @example '#avatar-container'
   * @example '.agent-video-wrapper'
   */
  avatarContainerSelector?: string;
  /**
   * Simple callback to receive agent audio data (Level 1 API - Simplest)
   * Automatically captures agent audio in opus-webm format with 100ms chunks
   * @example
   * ```typescript
   * onAudioData: (audioData) => {
   *   thirdPartySocket.send(audioData);
   * }
   * ```
   */
  onAudioData?: AudioCaptureCallback;
  /**
   * Advanced audio capture configuration (Level 2 API - More Control)
   * Use this if you need to specify format, source, or other options
   * @example
   * ```typescript
   * captureAudio: {
   *   source: 'both',
   *   format: 'pcm-f32',
   *   onData: (audioData, metadata) => {
   *     processAudio(audioData, metadata);
   *   }
   * }
   * ```
   */
  captureAudio?: AudioCaptureOptions;
};

/**
 * Definition of a client-side tool that can be called by the voice agent
 *
 * Tools allow agents to execute custom functions in the client environment,
 * such as retrieving user data, making API calls, or performing calculations.
 */
type Tool = {
  /** Unique name for the function (used by agent to identify the tool) */
  function_name: string;
  /** Clear description of what the function does (helps agent decide when to use it) */
  description: string;
  /** Array of parameters the function accepts */
  parameters?: ToolParameter[];
  /** Array of parameter names that are required for the function */
  required?: string[];
  /** Internal function mapping (used for tool execution) */
  func_map?: Record<string, unknown>;
  /** The implementation function to execute when the agent calls this tool */
  fn?: (...args: unknown[]) => unknown | Promise<unknown>;
};

/**
 * Definition of a parameter for a client-side tool
 * Describes the input that the function expects from the agent
 */
type ToolParameter = {
  /** Name of the parameter */
  name: string;
  /** Data type of the parameter (e.g., 'string', 'number', 'boolean') */
  type: string;
  /** Description of what the parameter represents */
  description: string;
};

/**
 * Internal representation of tools in the LLM/API format
 * Used for communication with the Hamsa backend
 * @private
 */
type LLMTool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<
        string,
        {
          type: string;
          description: string;
        }
      >;
      required: string[];
    };
    func_map?: Record<string, unknown>;
  };
};

/**
 * Response format for job details from the Hamsa API
 *
 * Returned by getJobDetails() method to check conversation completion
 * status and retrieve additional job metadata.
 */
type JobDetails = {
  /** Current status of the job (e.g., 'COMPLETED', 'IN_PROGRESS', 'FAILED') */
  status: string;
  /** Additional job properties that may be returned by the API */
  [key: string]: unknown;
};

/**
 * Data object passed to callStarted event handlers
 */
type CallStartedData = {
  /** Unique job/call ID for this conversation session */
  jobId: string;
};

/**
 * Event handler signatures for HamsaVoiceAgent
 *
 * Defines the type-safe interface for all events emitted by the HamsaVoiceAgent.
 * Each event specifies its exact handler signature, enabling full type safety
 * and IntelliSense support when using the event emitter API.
 *
 * @example
 * ```typescript
 * // Fully type-safe event handlers
 * agent.on('transcriptionReceived', (text: string) => {
 *   console.log('User said:', text);
 * });
 *
 * agent.on('connectionQualityChanged', ({ quality, metrics }) => {
 *   if (quality === 'poor') {
 *     showNetworkWarning(metrics);
 *   }
 * });
 *
 * agent.on('callStarted', ({ jobId }) => {
 *   console.log('Call started with ID:', jobId);
 *   analytics.trackCall(jobId);
 * });
 * ```
 */
type HamsaVoiceAgentEvents = {
  // Connection lifecycle events
  /** Emitted when connection is established (before call fully starts) */
  start: () => void;
  /** Emitted when call is fully started and ready with conversation details */
  callStarted: (data: CallStartedData) => void;
  /** Emitted when call ends (user or agent initiated) */
  callEnded: () => void;
  /** Emitted when call is paused */
  callPaused: () => void;
  /** Emitted when call is resumed */
  callResumed: () => void;
  /** Emitted when connection is closed */
  closed: () => void;
  /** Emitted when attempting to reconnect */
  reconnecting: () => void;
  /** Emitted when reconnection succeeds */
  reconnected: () => void;

  // Conversation events
  /** Emitted when user speech is transcribed */
  transcriptionReceived: (text: string) => void;
  /** Emitted when agent response is received */
  answerReceived: (text: string) => void;
  /**
   * Emitted for every conversation message (agent reply or user transcription)
   * with structured, streaming-aware metadata (id, role, isFinal, timestamp).
   * Use this to drive a chat UI; prefer it over the plain-string
   * `answerReceived`/`transcriptionReceived` events when rendering message bubbles.
   *
   * Note: this is dual-sourced (chat text streams AND voice transcriptions).
   * For a chat-only integration, prefer {@link chatMessageReceived}.
   */
  messageReceived: (message: ReceivedMessage) => void;
  /**
   * Emitted only for chat messages received on the chat text-stream channel
   * (`lk.chat`) — agent replies and the greeting in chat-only sessions.
   * Same `ReceivedMessage` shape (stable id for in-place updates, streaming
   * partials with `isFinal: false` followed by a final `isFinal: true`).
   *
   * Unlike {@link messageReceived}, this never fires for voice transcriptions,
   * so it is the deterministic event for chat UIs. Pair with `agentStateChanged`
   * for a typing indicator. In chat-only sessions, `answerReceived`,
   * `transcriptionReceived`, and audio events do not fire.
   */
  chatMessageReceived: (message: ReceivedMessage) => void;
  /** Emitted when agent starts speaking */
  speaking: () => void;
  /** Emitted when agent is listening */
  listening: () => void;
  /** Emitted when agent state changes (idle, initializing, listening, thinking, speaking) */
  agentStateChanged: (state: AgentState) => void;
  /** Emitted when a DTMF digit is successfully sent */
  dtmfSent: (digit: DTMFDigit) => void;
  /** Emitted when a chat message is successfully sent to the agent */
  messageSent: (text: string) => void;

  // Error events
  /** Emitted when an error occurs */
  error: (error: Error | HamsaApiError) => void;

  // Track events
  /** Emitted when a remote track is subscribed */
  trackSubscribed: (data: TrackSubscriptionData) => void;
  /** Emitted when a remote track is unsubscribed */
  trackUnsubscribed: (data: TrackUnsubscriptionData) => void;
  /** Emitted when a local track is published */
  localTrackPublished: (data: {
    track?: LocalTrack;
    publication: LocalTrackPublication;
  }) => void;

  // Analytics events
  /** Emitted when analytics data is updated */
  analyticsUpdated: (analytics: CallAnalyticsResult) => void;
  /** Emitted when connection quality changes */
  connectionQualityChanged: (data: ConnectionQualityData) => void;
  /** Emitted when connection state changes */
  connectionStateChanged: (state: ConnectionState) => void;
  /** Emitted when audio playback state changes */
  audioPlaybackChanged: (playing: boolean) => void;

  // Audio control events
  /** Emitted when microphone is muted */
  micMuted: () => void;
  /** Emitted when microphone is unmuted */
  micUnmuted: () => void;

  // Participant events
  /** Emitted when a participant connects */
  participantConnected: (participant: RemoteParticipant) => void;
  /** Emitted when a participant disconnects */
  participantDisconnected: (participant: RemoteParticipant) => void;

  // Data events
  /** Emitted when data is received */
  dataReceived: (message: Uint8Array, participant: Participant) => void;
  /** Emitted for custom events */
  customEvent: (
    eventType: string,
    eventData: unknown,
    metadata?: Record<string, unknown>
  ) => void;
  /** Emitted for informational messages */
  info: (info: string) => void;

  // Tool events
  /** Emitted when tools are registered with the agent */
  toolsRegistered: (tools: Tool[]) => void;
  /** Emitted when a client-side tool execution fails */
  rpcError: (functionName: string, error: unknown) => void;
};

/**
 * HamsaVoiceAgent - Main SDK class for voice agent integration
 *
 * This class provides the primary interface for integrating Hamsa voice agents
 * into web applications. It handles authentication, connection management,
 * conversation lifecycle, analytics, and client-side tool execution.
 *
 * Note: This class uses declaration merging with an interface (defined below)
 * to provide type-safe event handlers. This is intentional and safe.
 *
 * Key features:
 * - Real-time voice communication with AI agents
 * - Comprehensive analytics and quality monitoring
 * - Client-side tool integration for extended functionality
 * - Automatic screen wake lock management during calls
 * - Event-driven architecture for reactive applications
 * - Built-in error handling and reconnection logic
 *
 * @example Basic Usage
 * ```typescript
 * import { HamsaVoiceAgent } from '@hamsa-ai/voice-agents-sdk';
 *
 * const agent = new HamsaVoiceAgent('your_api_key');
 *
 * // Listen for events
 * agent.on('callStarted', () => console.log('Call started'));
 * agent.on('answerReceived', (text) => console.log('Agent said:', text));
 * agent.on('transcriptionReceived', (text) => console.log('User said:', text));
 *
 * // Start conversation
 * await agent.start({
 *   agentId: 'your_agent_id',
 *   voiceEnablement: true,
 *   params: { userName: 'John', context: 'support_inquiry' }
 * });
 * ```
 *
 * @example With Client-side Tools
 * ```typescript
 * const weatherTool = {
 *   function_name: 'getCurrentWeather',
 *   description: 'Gets current weather for a location',
 *   parameters: [
 *     { name: 'location', type: 'string', description: 'City name' }
 *   ],
 *   required: ['location'],
 *   fn: async (location) => {
 *     const response = await fetch(`/api/weather?city=${location}`);
 *     return response.json();
 *   }
 * };
 *
 * await agent.start({
 *   agentId: 'weather_agent_id',
 *   tools: [weatherTool],
 *   voiceEnablement: true
 * });
 * ```
 *
 * @example Analytics Monitoring
 * ```typescript
 * // Real-time quality monitoring
 * agent.on('connectionQualityChanged', ({ quality, metrics }) => {
 *   if (quality === 'poor') {
 *     showNetworkWarning();
 *   }
 * });
 *
 * // Periodic analytics updates
 * agent.on('analyticsUpdated', (analytics) => {
 *   updateDashboard({
 *     duration: analytics.performanceMetrics.callDuration,
 *     quality: analytics.connectionStats.quality,
 *     latency: analytics.connectionStats.latency
 *   });
 * });
 *
 * // Get analytics snapshot anytime
 * const analytics = agent.getCallAnalytics();
 * ```
 *
 * @example Track-based Audio Processing
 * ```typescript
 * // Handle incoming audio tracks from voice agent
 * agent.on('trackSubscribed', ({ track, publication, participant }) => {
 *   if (track.kind === 'audio') {
 *     // Option 1: Attach to DOM element (LiveKit way)
 *     track.attach(audioElement);
 *
 *     // Option 2: Create MediaStream for custom processing
 *     const stream = new MediaStream([track.mediaStreamTrack]);
 *     const audioContext = new AudioContext();
 *     const source = audioContext.createMediaStreamSource(stream);
 *     // Add custom audio processing...
 *   }
 * });
 *
 * // Handle local audio track availability
 * agent.on('localTrackPublished', ({ track, publication }) => {
 *   if (track && track.source === 'microphone') {
 *     // Access local microphone track for recording/analysis
 *     const stream = new MediaStream([track.mediaStreamTrack]);
 *     setupVoiceAnalyzer(stream);
 *   }
 * });
 * ```
 */
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: Intentional declaration merging for type-safe events
class HamsaVoiceAgent extends EventEmitter {
  /** Default fallback output volume when not connected */
  private static readonly DEFAULT_OUTPUT_VOLUME = 0.0;
  /** Default fallback input volume when not connected */
  private static readonly DEFAULT_INPUT_VOLUME = 0.0;
  /** Internal LiveKit manager instance for WebRTC communication */
  liveKitManager: LiveKitManager | null = null;

  /**
   * Hamsa API key for authentication. Null when calls are started with a call
   * token instead (see `StartOptions.callToken`).
   */
  apiKey: string | null;

  /**
   * The public key (`pk_…`) calls start with, when one was given: `start()`
   * mints a call token with it. Null otherwise.
   */
  publicKey: string | null;

  /** Base URL for Hamsa API endpoints */
  API_URL: string;

  /** LiveKit RTC WebSocket URL */
  LIVEKIT_URL: string;

  /** Enable debug logging for troubleshooting */
  debug: boolean;

  /** Job ID for tracking conversation completion status */
  jobId: string | null = null;

  /** Screen wake lock manager to prevent device sleep during calls */
  wakeLockManager: ScreenWakeLock;

  /** Flag to track if the user initiated the call end to prevent duplicate disconnection logic */
  private userInitiatedEnd = false;

  /** Debug logger instance for conditional logging */
  private readonly logger: DebugLogger;

  /**
   * Creates a new HamsaVoiceAgent instance
   *
   * @param apiKey - Your Hamsa API key (get from https://dashboard.tryhamsa.com).
   *   Leave it out, passing the config first, when every call starts with a
   *   call token: `new HamsaVoiceAgent({ region: 'eu' })`.
   * @param config - Optional configuration settings
   * @param config.region - Deployment region ('eu' | 'uae'). Defaults to 'eu'.
   * @param config.API_URL - Custom API endpoint URL. Overrides the region default.
   * @param config.LIVEKIT_URL - Custom LiveKit RTC URL. Overrides the region default.
   *
   * @example
   * ```typescript
   * // Using default region (EU)
   * const agent = new HamsaVoiceAgent('hamsa_api_key_here');
   *
   * // Using UAE region
   * const agent = new HamsaVoiceAgent('hamsa_api_key_here', { region: 'uae' });
   *
   * // Using custom endpoints (overrides region)
   * const agent = new HamsaVoiceAgent('hamsa_api_key_here', {
   *   API_URL: 'https://custom-api.example.com',
   *   LIVEKIT_URL: 'wss://custom-rtc.example.com'
   * });
   *
   * // A web page or app: a public key, and nothing else
   * const agent = new HamsaVoiceAgent({ publicKey: 'pk_…' });
   * await agent.start({ agentId });
   *
   * // A secret key on your server: the page gets each call's token from it
   * const agent = new HamsaVoiceAgent({ region: 'eu' });
   * await agent.start({ agentId, callToken: () => getTokenFromMyServer() });
   * ```
   */
  constructor(
    apiKeyOrConfig?: string | HamsaVoiceAgentConfig,
    config: HamsaVoiceAgentConfig = {}
  ) {
    super();
    const keyless =
      typeof apiKeyOrConfig === 'object' && apiKeyOrConfig !== null;
    const {
      region = 'eu',
      API_URL,
      LIVEKIT_URL,
      debug = false,
      publicKey,
    } = keyless ? apiKeyOrConfig : config;
    const regionDefaults = REGION_CONFIG[region];
    const apiKey = keyless ? null : (apiKeyOrConfig ?? null) || null;
    HamsaVoiceAgent.#refuseMisplacedKeys(apiKey, publicKey);
    this.liveKitManager = null;
    this.apiKey = apiKey;
    this.publicKey = publicKey || null;
    this.API_URL = API_URL ?? regionDefaults.API_URL;
    this.LIVEKIT_URL = LIVEKIT_URL ?? regionDefaults.LIVEKIT_URL;
    this.debug = debug;
    this.logger = createDebugLogger(debug);
    this.jobId = null;
    this.wakeLockManager = new ScreenWakeLock();
  }

  /**
   * A secret key never belongs in a page, and a public key goes in
   * `publicKey`. Both mistakes are caught here, before any request, with a
   * sentence that says what to do instead.
   */
  static #refuseMisplacedKeys(apiKey: string | null, publicKey?: string) {
    const inBrowser = typeof window !== 'undefined';
    if (
      inBrowser &&
      (apiKey?.startsWith('sk_') || publicKey?.startsWith('sk_'))
    ) {
      throw new Error(
        'A secret key (sk_…) must stay on your server, never in a web page or an app. Use a public key (pk_…) in the page, or have your server mint call tokens and pass them as callToken.'
      );
    }
    if (publicKey && !publicKey.startsWith('pk_')) {
      throw new Error(
        'publicKey must be a public key, starting with pk_. Find it on the API keys page of the Hamsa dashboard.'
      );
    }
    if (apiKey?.startsWith('pk_')) {
      throw new Error(
        "This is a public key: pass it as publicKey, new HamsaVoiceAgent({ publicKey: 'pk_…' })."
      );
    }
  }

  /**
   * Adjusts the volume level for voice agent audio playback
   *
   * Controls the volume of the voice agent's speech output. This affects
   * all audio playback from the agent but does not change the user's
   * microphone input level.
   *
   * @param volume - Volume level between 0.0 (muted) and 1.0 (full volume)
   *
   * @example
   * ```typescript
   * // Set to half volume
   * agent.setVolume(0.5);
   *
   * // Mute agent completely
   * agent.setVolume(0);
   *
   * // Full volume
   * agent.setVolume(1.0);
   *
   * // Can be called during active conversation
   * agent.on('callStarted', () => {
   *   agent.setVolume(0.8); // Slightly quieter
   * });
   * ```
   */
  setVolume(volume: number): void {
    if (this.liveKitManager) {
      this.liveKitManager.setVolume(volume);
    }
  }

  /**
   * Gets the current output volume level
   *
   * Returns the current volume setting for voice agent audio playback.
   * This represents the playback volume for all voice agent audio streams.
   *
   * @returns Current output volume level (0.0 = muted, 1.0 = full volume)
   *
   * @example
   * ```typescript
   * const currentVolume = agent.getOutputVolume();
   * console.log(`Volume: ${Math.round(currentVolume * 100)}%`);
   * ```
   */
  getOutputVolume(): number {
    return (
      this.liveKitManager?.audioManager.getOutputVolume() ??
      HamsaVoiceAgent.DEFAULT_OUTPUT_VOLUME
    );
  }

  /**
   * Gets the current job/call ID for this conversation
   *
   * The job ID uniquely identifies this conversation session and can be used
   * to track the conversation, retrieve analytics, or poll for completion status
   * using the getJobDetails() method.
   *
   * @returns The job/call ID, or null if conversation hasn't started yet
   *
   * @example
   * ```typescript
   * // Get job ID when call starts
   * agent.on('callStarted', () => {
   *   const callId = agent.getJobId();
   *   console.log('Call ID:', callId);
   *
   *   // Send to analytics service
   *   analytics.trackCall(callId);
   *
   *   // Store for later reference
   *   localStorage.setItem('lastCallId', callId);
   * });
   *
   * // Use job ID to check completion status
   * agent.on('callEnded', async () => {
   *   const jobId = agent.getJobId();
   *   if (jobId) {
   *     const details = await agent.getJobDetails();
   *     console.log('Call completed:', details);
   *   }
   * });
   * ```
   */
  getJobId(): string | null {
    return this.jobId;
  }

  /**
   * Gets the current input volume level from the user's microphone
   *
   * Returns the current microphone input level for voice activity detection.
   * Can be used to create visual feedback for user speaking indicators.
   *
   * @returns Current input volume level (0.0 = no input, 1.0 = maximum input)
   *
   * @example
   * ```typescript
   * // Create voice activity indicator
   * setInterval(() => {
   *   const inputLevel = agent.getInputVolume();
   *   updateMicrophoneIndicator(inputLevel);
   * }, 100);
   * ```
   */
  getInputVolume(): number {
    return (
      this.liveKitManager?.audioManager.getInputVolume() ??
      HamsaVoiceAgent.DEFAULT_INPUT_VOLUME
    );
  }

  /**
   * Mutes or unmutes the user's microphone
   *
   * Controls the user's microphone input to the voice agent conversation.
   * When muted, the user's voice will not be transmitted to the agent.
   *
   * @param muted - True to mute microphone, false to unmute
   *
   * @example
   * ```typescript
   * // Mute microphone
   * agent.setMicMuted(true);
   *
   * // Toggle microphone
   * const isMuted = agent.isMicMuted();
   * agent.setMicMuted(!isMuted);
   * ```
   */
  setMicMuted(muted: boolean): void {
    if (this.liveKitManager) {
      this.liveKitManager.audioManager.setMicMuted(muted);
    }
  }

  /**
   * Checks if the user's microphone is currently muted
   *
   * @returns True if microphone is muted, false if unmuted
   *
   * @example
   * ```typescript
   * if (agent.isMicMuted()) {
   *   showUnmutePrompt();
   * }
   * ```
   */
  isMicMuted(): boolean {
    return this.liveKitManager?.audioManager.isMicMuted() ?? false;
  }

  /**
   * @internal
   * Notifies the agent about user activity
   *
   * Prevents the agent from interrupting when the user is actively interacting
   * with the interface. The agent will not attempt to speak for at least 2 seconds
   * after user activity is detected.
   *
   * @example
   * ```typescript
   * // Prevent interruptions while user is typing
   * textInput.addEventListener('input', () => {
   *   agent.sendUserActivity();
   * });
   *
   * // Prevent interruptions during UI interactions
   * document.addEventListener('click', () => {
   *   agent.sendUserActivity();
   * });
   * ```
   */
  sendUserActivity(): void {
    if (this.liveKitManager?.isConnected) {
      // Send user activity signal to prevent agent interruption
      // This could be implemented as a special data message to the agent
      this.logger.log(
        'User activity detected - preventing agent interruption',
        {
          source: 'HamsaVoiceAgent',
        }
      );
    }
  }

  /**
   * @internal
   * Sends a contextual update to the agent
   *
   * Informs the agent about user actions or state changes that are not direct
   * conversation messages but may influence the agent's responses. Unlike regular
   * messages, contextual updates don't trigger the agent to take its turn in
   * the conversation.
   *
   * @param context - Contextual information to send to the agent
   *
   * @example
   * ```typescript
   * // Inform agent about navigation
   * agent.sendContextualUpdate("User navigated to checkout page");
   *
   * // Inform about app state changes
   * agent.sendContextualUpdate("User's cart total: $127.50");
   *
   * // Inform about user preferences
   * agent.sendContextualUpdate("User selected dark mode theme");
   * ```
   */
  sendContextualUpdate(context: string): void {
    if (this.liveKitManager?.isConnected) {
      // Send contextual update without triggering agent response
      this.logger.log('Sending contextual update', {
        source: 'HamsaVoiceAgent',
        error: { context },
      });
      // This could be implemented as a special non-conversational message
    }
  }

  /**
   * Sends a DTMF (Dual-Tone Multi-Frequency) digit to the voice agent
   *
   * Simulates pressing a key on a phone keypad during the call. This enables
   * browser-based call testing with DTMF input simulation, allowing users to
   * test IVR flows and DTMF transitions without making actual phone calls.
   *
   * Uses LiveKit's native DTMF API (publishDtmf) which properly integrates with
   * telephony systems and SIP infrastructure per RFC 4733 standard.
   *
   * @param digit - A single DTMF digit: '0'-'9', '*', or '#'
   * @throws {Error} If called when not connected (no active call)
   * @throws {Error} If the digit is not a valid DTMF character
   * @fires dtmfSent When a DTMF digit is successfully sent to the agent
   *
   * @example Basic usage
   * ```typescript
   * const agent = new HamsaVoiceAgent(apiKey, config);
   * await agent.start({ agentId, params });
   *
   * // Listen for DTMF send confirmations
   * agent.on('dtmfSent', (digit) => {
   *   console.log(`Sent DTMF digit: ${digit}`);
   *   highlightKeypadButton(digit);
   * });
   *
   * // Later, when user presses a key on the UI keypad:
   * agent.sendDTMF('1');  // Simulates pressing "1"
   * agent.sendDTMF('*');  // Simulates pressing "*"
   * agent.sendDTMF('#');  // Simulates pressing "#"
   * ```
   *
   * @example With UI keypad
   * ```typescript
   * // Create keypad buttons
   * const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
   *
   * digits.forEach(digit => {
   *   const button = document.createElement('button');
   *   button.textContent = digit;
   *   button.onclick = () => {
   *     try {
   *       agent.sendDTMF(digit);
   *       playKeyTone(digit); // Optional: play local tone feedback
   *     } catch (error) {
   *       console.error('Failed to send DTMF:', error.message);
   *     }
   *   };
   *   keypadContainer.appendChild(button);
   * });
   * ```
   *
   * @example Error handling
   * ```typescript
   * try {
   *   agent.sendDTMF('1');
   * } catch (error) {
   *   if (error.message.includes('not connected')) {
   *     showConnectionError();
   *   } else if (error.message.includes('Invalid DTMF')) {
   *     showInvalidInputError();
   *   }
   * }
   * ```
   */
  sendDTMF(digit: DTMFDigit): void {
    // DTMF code mapping per RFC 4733
    // See: https://datatracker.ietf.org/doc/html/rfc4733#section-3.2
    const dtmfCodeMap: Record<DTMFDigit, number> = {
      '0': 0,
      '1': 1,
      '2': 2,
      '3': 3,
      '4': 4,
      '5': 5,
      '6': 6,
      '7': 7,
      '8': 8,
      '9': 9,
      '*': 10,
      '#': 11,
    };

    // Validate the digit is a valid DTMF character
    if (!(digit in dtmfCodeMap)) {
      throw new Error(
        `Invalid DTMF digit: "${digit}". Valid digits are 0-9, *, and #.`
      );
    }

    // Check if connected
    const room = this.liveKitManager?.connection?.room;
    if (!(this.liveKitManager?.isConnected && room?.localParticipant)) {
      throw new Error(
        'Cannot send DTMF: not connected to voice agent. Call start() first.'
      );
    }

    const code = dtmfCodeMap[digit];

    this.logger.log('Sending DTMF digit', {
      source: 'HamsaVoiceAgent',
      error: {
        digit,
        code,
      },
    });

    // Use LiveKit's native DTMF API
    // This properly integrates with SIP/telephony systems
    room.localParticipant.publishDtmf(code, digit);

    this.logger.log('DTMF digit sent successfully', {
      source: 'HamsaVoiceAgent',
      error: { digit, code },
    });

    // Emit event to notify listeners
    this.emit('dtmfSent', digit);
  }

  /**
   * Sends a text chat message to the agent
   *
   * Publishes the user's typed message to the agent over LiveKit's text-stream
   * channel ({@link LIVEKIT_CHAT_TOPIC}). Use this to drive a text/chat UI,
   * typically alongside a chat-only session started with `start({ isChatOnly: true })`.
   *
   * The agent's reply arrives asynchronously through the `answerReceived` event.
   * This method does not return the reply.
   *
   * @param text - The message to send. Must be a non-empty string.
   * @throws {Error} If called when not connected (no active session)
   * @throws {Error} If `text` is empty or not a string
   * @fires messageSent When the message is successfully sent to the agent
   *
   * @example
   * ```typescript
   * await agent.start({ agentId: 'support_agent', isChatOnly: true });
   *
   * // Render the agent's replies
   * agent.on('answerReceived', (reply) => appendToChat('agent', reply));
   *
   * // Send the user's typed message
   * sendButton.onclick = async () => {
   *   const text = input.value;
   *   appendToChat('user', text);
   *   await agent.sendMessage(text);
   * };
   * ```
   */
  async sendMessage(text: string): Promise<void> {
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Cannot send message: text must be a non-empty string.');
    }

    const room = this.liveKitManager?.connection?.room;
    if (!(this.liveKitManager?.isConnected && room?.localParticipant)) {
      throw new Error(
        'Cannot send message: not connected to agent. Call start() first.'
      );
    }

    const TEXT_PREVIEW_LENGTH = 50;
    this.logger.log('Sending chat message', {
      source: 'HamsaVoiceAgent',
      error: {
        length: text.length,
        preview: text.substring(0, TEXT_PREVIEW_LENGTH),
        topic: LIVEKIT_CHAT_TOPIC,
      },
    });

    try {
      await room.localParticipant.sendText(text, {
        topic: LIVEKIT_CHAT_TOPIC,
      });
    } catch (error) {
      this.logger.error('Failed to send chat message', {
        source: 'HamsaVoiceAgent',
        error,
      });
      this.emit(
        'error',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }

    this.logger.log('Chat message sent successfully', {
      source: 'HamsaVoiceAgent',
    });

    // Emit event to notify listeners (e.g. for optimistic UI / local echo)
    this.emit('messageSent', text);
  }

  /**
   * Gets frequency data from the user's microphone input
   *
   * Returns frequency domain data for audio visualization and analysis.
   * Can be used to create voice activity indicators, audio visualizers,
   * or advanced voice processing features.
   *
   * @returns Uint8Array containing frequency data (0-255 per frequency bin)
   *
   * @example
   * ```typescript
   * // Create simple audio visualizer
   * function updateVisualizer() {
   *   const frequencyData = agent.getInputByteFrequencyData();
   *   const average = frequencyData.reduce((a, b) => a + b) / frequencyData.length;
   *   const percentage = Math.round((average / 255) * 100);
   *   document.getElementById('micLevel').style.width = `${percentage}%`;
   * }
   * setInterval(updateVisualizer, 50);
   * ```
   */
  getInputByteFrequencyData(): Uint8Array {
    return (
      this.liveKitManager?.audioManager.getInputByteFrequencyData() ??
      new Uint8Array(0)
    );
  }

  /**
   * Gets frequency data from the agent's audio output
   *
   * Returns frequency domain data from the agent's voice for analysis
   * and visualization. Useful for creating voice characteristic displays
   * or audio processing features.
   *
   * @returns Uint8Array containing frequency data (0-255 per frequency bin)
   *
   * @example
   * ```typescript
   * // Analyze agent voice characteristics
   * agent.on('speaking', () => {
   *   const interval = setInterval(() => {
   *     const frequencyData = agent.getOutputByteFrequencyData();
   *     const dominantFreq = findDominantFrequency(frequencyData);
   *     updateVoiceAnalysis(dominantFreq);
   *   }, 100);
   *
   *   agent.once('listening', () => clearInterval(interval));
   * });
   * ```
   */
  getOutputByteFrequencyData(): Uint8Array {
    return (
      this.liveKitManager?.audioManager.getOutputByteFrequencyData() ??
      new Uint8Array(0)
    );
  }

  /**
   * Enables real-time audio capture from the conversation
   *
   * This method allows clients to receive raw audio data from the agent, user, or both,
   * enabling use cases like forwarding audio to third-party services, custom recording,
   * real-time transcription, or audio analysis.
   *
   * The audio can be captured in three formats:
   * - `opus-webm`: Efficient Opus codec in WebM container (default, recommended)
   * - `pcm-f32`: Raw PCM audio as Float32Array for advanced processing
   * - `pcm-i16`: Raw PCM audio as Int16Array for compatibility
   *
   * @param options - Configuration options for audio capture
   * @param options.source - Which audio to capture: 'agent' (default), 'user', or 'both'
   * @param options.format - Audio format to receive (default: 'opus-webm')
   * @param options.chunkSize - Chunk size in milliseconds for encoded formats (default: 100ms)
   * @param options.bufferSize - Buffer size in samples for PCM formats (default: 4096)
   * @param options.callback - Function called with each audio chunk
   *
   * @example Forward agent audio to third-party service
   * ```typescript
   * // Start capturing agent audio when call begins
   * agent.on('callStarted', () => {
   *   agent.enableAudioCapture({
   *     source: 'agent',
   *     format: 'opus-webm',
   *     chunkSize: 100, // 100ms chunks
   *     callback: (audioData, metadata) => {
   *       console.log(`Audio from ${metadata.participant}: ${audioData.byteLength} bytes`);
   *
   *       // Send to third-party service via WebSocket
   *       thirdPartyWebSocket.send(audioData);
   *
   *       // Or via HTTP
   *       fetch('https://api.example.com/audio', {
   *         method: 'POST',
   *         body: audioData,
   *         headers: {
   *           'Content-Type': 'audio/webm',
   *           'X-Participant': metadata.participant,
   *           'X-Timestamp': metadata.timestamp.toString()
   *         }
   *       });
   *     }
   *   });
   * });
   * ```
   *
   * @example Capture both agent and user for custom processing
   * ```typescript
   * agent.enableAudioCapture({
   *   source: 'both',
   *   format: 'pcm-f32',
   *   bufferSize: 4096,
   *   callback: (audioData, metadata) => {
   *     const samples = audioData as Float32Array;
   *
   *     if (metadata.source === 'agent') {
   *       // Process agent audio
   *       analyzeAgentVoice(samples, metadata.sampleRate);
   *     } else {
   *       // Process user audio
   *       analyzeUserVoice(samples, metadata.sampleRate);
   *     }
   *
   *     // Save to custom recorder
   *     customRecorder.addAudioChunk({
   *       source: metadata.source,
   *       samples,
   *       sampleRate: metadata.sampleRate,
   *       timestamp: metadata.timestamp
   *     });
   *   }
   * });
   * ```
   *
   * @example Real-time transcription integration
   * ```typescript
   * import { AudioCaptureOptions } from '@hamsa-ai/voice-agents-sdk';
   *
   * const transcriptionService = new WebSocket('wss://transcription.example.com');
   *
   * agent.enableAudioCapture({
   *   source: 'user',
   *   format: 'opus-webm',
   *   chunkSize: 50, // Lower latency for real-time transcription
   *   callback: (audioData, metadata) => {
   *     // Forward user audio to transcription service
   *     transcriptionService.send(JSON.stringify({
   *       audio: Array.from(new Uint8Array(audioData as ArrayBuffer)),
   *       timestamp: metadata.timestamp,
   *       sampleRate: metadata.sampleRate
   *     }));
   *   }
   * });
   *
   * transcriptionService.onmessage = (event) => {
   *   const transcription = JSON.parse(event.data);
   *   console.log('Real-time transcription:', transcription.text);
   *   displayUserSpeech(transcription.text);
   * };
   * ```
   */
  enableAudioCapture(options: AudioCaptureOptions): void {
    if (!this.liveKitManager) {
      throw new Error('Cannot enable audio capture: not connected to agent');
    }
    this.liveKitManager.audioManager.enableAudioCapture(options);
  }

  /**
   * Disables audio capture and releases all capture resources
   *
   * Stops all active audio capture, cleans up MediaRecorders and audio processors,
   * and releases associated resources. Safe to call even if audio capture is not enabled.
   *
   * @example
   * ```typescript
   * // Stop capturing when call ends
   * agent.on('callEnded', () => {
   *   agent.disableAudioCapture();
   *   console.log('Audio capture stopped');
   * });
   *
   * // Or stop manually
   * stopCaptureButton.addEventListener('click', () => {
   *   agent.disableAudioCapture();
   * });
   * ```
   */
  disableAudioCapture(): void {
    this.liveKitManager?.audioManager.disableAudioCapture();
  }

  /**
   * Initiates a new voice agent conversation
   *
   * This is the primary method for starting interactions with a voice agent.
   * It handles authentication, connection establishment, tool registration,
   * and event forwarding. The method is asynchronous and will emit events
   * to indicate connection status and conversation progress.
   *
   * @param options - Configuration options for the conversation
   * @param options.agentId - Unique identifier of the voice agent (from Hamsa dashboard)
   * @param options.params - Parameters to customize the conversation context
   * @param options.voiceEnablement - Turn on page tools (`tools` that run in the page); not needed for voice
   * @param options.tools - Client-side tools available to the agent
   *
   * @throws {Error} Authentication failures, network errors, or invalid configuration
   *
   * @example Basic voice conversation
   * ```typescript
   * try {
   *   await agent.start({
   *     agentId: 'agent_12345',
   *     voiceEnablement: true,
   *     params: {
   *       userName: 'Alice',
   *       userTier: 'premium',
   *       sessionContext: 'product_support'
   *     }
   *   });
   *   console.log('Voice agent conversation started');
   * } catch (error) {
   *   console.error('Failed to start conversation:', error);
   * }
   * ```
   *
   * @example With custom tools
   * ```typescript
   * const customerDataTool = {
   *   function_name: 'getCustomerData',
   *   description: 'Retrieves customer account information',
   *   parameters: [
   *     { name: 'customerId', type: 'string', description: 'Customer ID' }
   *   ],
   *   required: ['customerId'],
   *   fn: async (customerId) => {
   *     return await customerAPI.getProfile(customerId);
   *   }
   * };
   *
   * await agent.start({
   *   agentId: 'support_agent',
   *   voiceEnablement: true,
   *   tools: [customerDataTool],
   *   params: { department: 'billing' }
   * });
   * ```
   *
   * @example Event handling
   * ```typescript
   * // Set up event listeners before starting
   * agent.on('callStarted', () => {
   *   console.log('Conversation began');
   *   startRecordingMetrics();
   * });
   *
   * agent.on('error', (error) => {
   *   console.error('Conversation error:', error);
   *   handleConversationError(error);
   * });
   *
   * await agent.start({ agentId: 'my_agent', voiceEnablement: true });
   * ```
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Method sets up multiple event listeners with logging - refactoring would split event handling logic
  async start({
    agentId,
    versionRef,
    environmentId,
    callToken,
    callerKey,
    params = {},
    voiceEnablement = false,
    isChatOnly = false,
    tools = [],
    userId: _userId,
    preferHeadphonesForIosDevices: _preferHeadphonesForIosDevices = false,
    connectionDelay: _connectionDelay,
    disableWakeLock: _disableWakeLock = false,
    onAudioData,
    captureAudio,
    avatarContainerSelector,
  }: StartOptions): Promise<void> {
    try {
      this.logger.log('SDK initialized - disconnect debugging enabled', {
        source: 'HamsaVoiceAgent',
      });

      // Reset user-initiated end flag for new call
      this.userInitiatedEnd = false;

      // Get LiveKit access token
      this.logger.log('Starting conversation initialization', {
        source: 'HamsaVoiceAgent',
        error: {
          agentId,
          voiceEnablement,
          toolsCount: tools?.length ?? 0,
          hasParams: Object.keys(params).length > 0,
        },
      });

      if (
        callerKey !== undefined &&
        (typeof callerKey !== 'string' ||
          callerKey.length < 1 ||
          callerKey.length > MAX_CALLER_KEY_LENGTH)
      ) {
        throw new Error(
          'Cannot start a call: callerKey must be a string of 1 to 200 characters.'
        );
      }

      // A token given (or fetched by the function given), else one minted
      // with the public key, else none: the API key starts the call as before.
      const token = await this.#resolveCallToken({
        agentId,
        callToken,
        isChatOnly,
        callerKey,
        versionRef,
        environmentId,
      });

      const accessToken = await this.#initializeLiveKitConversation({
        voiceAgentId: agentId,
        callerKey,
        // A call token already decides both; the backend ignores them next to
        // one, so they are not sent at all.
        versionRef: token ? undefined : versionRef,
        environmentId: token ? undefined : environmentId,
        authorization: this.#authorizationFor(token),
        params,
        voiceEnablement,
        tools,
        isChatOnly,
      });

      // Create LiveKitManager instance
      this.logger.log('Creating LiveKitManager instance', {
        source: 'HamsaVoiceAgent',
        error: {
          livekitUrl: this.LIVEKIT_URL,
          tokenLength: accessToken.length,
          debug: this.debug,
        },
      });

      this.liveKitManager = new LiveKitManager(
        this.LIVEKIT_URL,
        accessToken,
        tools,
        { debug: this.debug, avatarContainerSelector, isChatOnly }
      );

      this.logger.log('LiveKitManager created, setting up event listeners', {
        source: 'HamsaVoiceAgent',
      });

      // Set up event listeners to forward LiveKitManager events
      this.liveKitManager
        .on('error', (error) => {
          this.logger.error('LiveKitManager error event', {
            source: 'HamsaVoiceAgent',
            error,
          });
          this.emit('error', error);
        })
        .on('connected', () => {
          this.logger.log('LiveKit connection established', {
            source: 'HamsaVoiceAgent',
          });

          // Set up audio capture if requested
          // Level 2 API takes priority over Level 1 if both are provided
          if (captureAudio) {
            // Level 2 API: Advanced captureAudio options
            this.logger.log('Enabling audio capture via captureAudio options', {
              source: 'HamsaVoiceAgent',
              error: {
                source: captureAudio.source,
                format: captureAudio.format,
              },
            });
            this.liveKitManager?.audioManager.enableAudioCapture(captureAudio);
          } else if (onAudioData) {
            // Level 1 API: Simple onAudioData callback
            this.logger.log('Enabling audio capture via onAudioData', {
              source: 'HamsaVoiceAgent',
            });
            this.liveKitManager?.audioManager.enableAudioCapture({
              source: 'agent',
              format: 'opus-webm',
              chunkSize: 100,
              callback: onAudioData,
            });
          }

          this.emit('start');
        })
        .on('transcriptionReceived', (transcription) => {
          const TEXT_PREVIEW_LENGTH = 50;
          this.logger.log('Transcription received from user', {
            source: 'HamsaVoiceAgent',
            error: {
              length: transcription.length,
              preview: transcription.substring(0, TEXT_PREVIEW_LENGTH),
            },
          });
          this.emit('transcriptionReceived', transcription);
        })
        .on('answerReceived', (answer) => {
          const TEXT_PREVIEW_LENGTH = 50;
          this.logger.log('Answer received from agent', {
            source: 'HamsaVoiceAgent',
            error: {
              length: answer.length,
              preview: answer.substring(0, TEXT_PREVIEW_LENGTH),
            },
          });
          this.emit('answerReceived', answer);
        })
        .on('messageReceived', (message) => {
          this.emit('messageReceived', message);
        })
        .on('chatMessageReceived', (message) => {
          this.emit('chatMessageReceived', message);
        })
        .on('speaking', () => {
          this.logger.log('Agent started speaking', {
            source: 'HamsaVoiceAgent',
          });
          this.emit('speaking');
        })
        .on('listening', () => {
          this.logger.log('Agent started listening', {
            source: 'HamsaVoiceAgent',
          });
          this.emit('listening');
        })
        .on('disconnected', () => {
          const disconnectedEventTime = Date.now();
          this.logger.log(
            'disconnected event fired - room connection closed - TIMING',
            {
              source: 'HamsaVoiceAgent',
              error: {
                timestamp: disconnectedEventTime,
                userInitiatedEnd: this.userInitiatedEnd,
              },
            }
          );
          // Always emit callEnded when connection ends
          this.emit('callEnded');
          const closedEventTime = Date.now();
          this.emit('closed');
          this.logger.log('closed event emitted - TIMING', {
            source: 'HamsaVoiceAgent',
            error: {
              timestamp: closedEventTime,
              timeSinceDisconnected: closedEventTime - disconnectedEventTime,
            },
          });
          // Reset the flag when fully disconnected
          this.userInitiatedEnd = false;
        })
        .on('trackSubscribed', (data) => {
          this.logger.log('Track subscribed', {
            source: 'HamsaVoiceAgent',
            error: {
              kind: data.track?.kind,
              trackSid: data.track?.sid,
              participant: data.participant,
            },
          });
          this.emit('trackSubscribed', data);
        })
        .on('trackUnsubscribed', (data) => {
          this.logger.log('Track unsubscribed', {
            source: 'HamsaVoiceAgent',
            error: {
              kind: data.track?.kind,
              trackSid: data.track?.sid,
              participant: data.participant,
            },
          });
          this.emit('trackUnsubscribed', data);
        })
        .on('localTrackPublished', (data) => {
          this.logger.log('Local track published', {
            source: 'HamsaVoiceAgent',
            error: {
              kind: data.publication?.kind,
              trackSid: data.publication?.trackSid,
            },
          });
          this.emit('localTrackPublished', data);
        })
        .on('info', (info) => {
          this.logger.log('Info message received', {
            source: 'HamsaVoiceAgent',
            error: { info },
          });
          this.emit('info', info);
        })

        // Forward new analytics events
        .on('reconnecting', () => {
          this.logger.warn('Connection reconnecting', {
            source: 'HamsaVoiceAgent',
          });
          this.emit('reconnecting');
        })
        .on('reconnected', () => {
          this.logger.log('Connection reconnected successfully', {
            source: 'HamsaVoiceAgent',
          });
          this.emit('reconnected');
        })
        .on('participantConnected', (participant) => {
          this.logger.log('Participant connected', {
            source: 'HamsaVoiceAgent',
            error: {
              identity: participant.identity,
              sid: participant.sid,
            },
          });
          this.emit('participantConnected', participant);
        })
        .on('participantDisconnected', (participant) => {
          this.logger.log('Participant disconnected', {
            source: 'HamsaVoiceAgent',
            error: {
              identity: participant.identity,
              sid: participant.sid,
              hasAgentInIdentity: participant.identity?.includes('agent'),
              remainingCount:
                this.liveKitManager?.connection.participants.size ?? 0,
            },
          });

          this.emit('participantDisconnected', participant);
        })
        .on('agentStateChanged', (state) => {
          this.logger.log('Agent state changed', {
            source: 'HamsaVoiceAgent',
            error: { state },
          });
          this.emit('agentStateChanged', state);
        })
        .on('connectionQualityChanged', (data) => {
          this.logger.log('Connection quality changed', {
            source: 'HamsaVoiceAgent',
            error: {
              quality: data.quality,
              participant: data.participant,
            },
          });
          this.emit('connectionQualityChanged', data);
        })
        .on('connectionStateChanged', (state) => {
          this.logger.log('Connection state changed', {
            source: 'HamsaVoiceAgent',
            error: { state },
          });
          this.emit('connectionStateChanged', state);
        })
        .on('audioPlaybackChanged', (playing) => {
          this.logger.log('Audio playback state changed', {
            source: 'HamsaVoiceAgent',
            error: { playing },
          });
          this.emit('audioPlaybackChanged', playing);
        })
        .on('micMuted', () => {
          this.logger.log('Microphone muted', {
            source: 'HamsaVoiceAgent',
          });
          this.emit('micMuted');
        })
        .on('micUnmuted', () => {
          this.logger.log('Microphone unmuted', {
            source: 'HamsaVoiceAgent',
          });
          this.emit('micUnmuted');
        })
        .on('analyticsUpdated', (analytics) =>
          this.emit('analyticsUpdated', analytics)
        )
        .on('customEvent', (eventType, eventData, metadata) =>
          this.emit('customEvent', eventType, eventData, metadata)
        )
        .on('dataReceived', (message, participant) =>
          this.emit('dataReceived', message, participant)
        )
        .on('toolsRegistered', (registeredTools) =>
          this.emit('toolsRegistered', registeredTools)
        )
        .on('rpcError', (functionName, error) =>
          this.emit('rpcError', functionName, error)
        );

      // Connect to LiveKit room
      this.logger.log('Connecting to LiveKit room', {
        source: 'HamsaVoiceAgent',
        error: {
          livekitUrl: this.LIVEKIT_URL,
        },
      });
      const connectStart = Date.now();
      await this.liveKitManager.connect();
      const connectDuration = Date.now() - connectStart;
      this.logger.log('Connected to LiveKit room', {
        source: 'HamsaVoiceAgent',
        error: {
          duration: `${connectDuration}ms`,
        },
      });

      // Acquire the screen wake lock when the call starts
      this.logger.log('Acquiring screen wake lock', {
        source: 'HamsaVoiceAgent',
      });
      try {
        await this.wakeLockManager.acquire();
        this.logger.log('Screen wake lock acquired successfully', {
          source: 'HamsaVoiceAgent',
        });
      } catch (error) {
        this.logger.warn('Failed to acquire screen wake lock', {
          source: 'HamsaVoiceAgent',
          error: {
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
      this.logger.log('Call started successfully', {
        source: 'HamsaVoiceAgent',
        error: {
          totalStartupTime: `${Date.now() - connectStart}ms`,
          jobId: this.jobId,
        },
      });
      this.emit('callStarted', { jobId: this.jobId ?? '' });
    } catch (error) {
      this.logger.error('Failed to start call', {
        source: 'HamsaVoiceAgent',
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          isHamsaApiError: error instanceof HamsaApiError,
        },
      });

      // HamsaApiError as it is, to keep messageKey; anything else with context.
      const reported =
        error instanceof HamsaApiError
          ? error
          : new Error(
              `Failed to start call: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
      if (this.listenerCount('error') > 0) {
        this.emit('error', reported);
        return;
      }
      // Nobody listens for `error`: without this the call would fail silently,
      // start() resolving as if it had started.
      throw reported;
    }
  }

  /**
   * Terminates the current voice agent conversation
   *
   * Safely ends the conversation, disconnects from the WebRTC session,
   * releases system resources (including screen wake lock), and performs
   * cleanup. This method should be called when the conversation is complete.
   *
   * @example
   * ```typescript
   * // End conversation when user clicks hang up
   * hangupButton.addEventListener('click', () => {
   *   agent.end();
   * });
   *
   * // End conversation after timeout
   * setTimeout(() => {
   *   agent.end();
   *   console.log('Conversation ended due to timeout');
   * }, 300000); // 5 minutes
   *
   * // Listen for end event
   * agent.on('callEnded', () => {
   *   console.log('Conversation terminated');
   *   updateUI('disconnected');
   *   saveConversationSummary();
   * });
   * ```
   */
  end(): void {
    const endStartTime = Date.now();
    this.logger.log('end() called - START DISCONNECT TIMING', {
      source: 'HamsaVoiceAgent',
      error: {
        timestamp: endStartTime,
        userInitiatedEnd: this.userInitiatedEnd,
        isConnected: this.liveKitManager?.isConnected ?? false,
        stack: new Error('Stack trace').stack,
      },
    });

    // Perform disconnect asynchronously but don't block
    this.#performDisconnect(endStartTime)
      .then(() => {
        const endCompleteTime = Date.now();
        this.logger.log('end() completed - END DISCONNECT TIMING', {
          source: 'HamsaVoiceAgent',
          error: {
            timestamp: endCompleteTime,
            totalDuration: endCompleteTime - endStartTime,
          },
        });
      })
      .catch((error) => {
        this.#handleEndError(error, endStartTime);
      });

    this.#releaseWakeLock();
  }

  /**
   * Performs the disconnect operation with timing logs
   * @private
   */
  async #performDisconnect(endStartTime: number): Promise<void> {
    if (!this.liveKitManager) {
      return;
    }

    this.userInitiatedEnd = true;

    const disconnectCallTime = Date.now();
    this.logger.log('Calling liveKitManager.disconnect()', {
      source: 'HamsaVoiceAgent',
      error: {
        timestamp: disconnectCallTime,
        timeSinceEndCalled: disconnectCallTime - endStartTime,
      },
    });

    await this.liveKitManager.disconnect();

    const afterDisconnectCallTime = Date.now();
    this.logger.log('liveKitManager.disconnect() completed', {
      source: 'HamsaVoiceAgent',
      error: {
        timestamp: afterDisconnectCallTime,
        disconnectCallDuration: afterDisconnectCallTime - disconnectCallTime,
      },
    });

    this.emit('callEnded');

    const afterCallEndedTime = Date.now();
    this.logger.log('callEnded event emitted', {
      source: 'HamsaVoiceAgent',
      error: {
        timestamp: afterCallEndedTime,
        totalTimeInEndMethod: afterCallEndedTime - endStartTime,
      },
    });
  }

  /**
   * Releases the screen wake lock
   * @private
   */
  #releaseWakeLock(): void {
    if (this.wakeLockManager?.isActive()) {
      this.wakeLockManager.release().catch((_err) => {
        // Intentionally ignore wake lock release errors
      });
    }
  }

  /**
   * Handles errors that occur during end()
   * @private
   */
  #handleEndError(error: unknown, endStartTime: number): void {
    this.logger.error('end() threw error', {
      source: 'HamsaVoiceAgent',
      error: {
        error: error instanceof Error ? error.message : String(error),
        timeSinceStart: Date.now() - endStartTime,
      },
    });

    if (this.listenerCount('error') > 0) {
      if (error instanceof HamsaApiError) {
        this.emit('error', error);
      } else {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.emit('error', new Error(`Failed to end call: ${errorMessage}`));
      }
    }
  }

  /**
   * Temporarily pauses the voice agent conversation
   *
   * Pauses audio transmission and reception while maintaining the underlying
   * connection. The conversation can be resumed later using resume(). This
   * is useful for temporary interruptions without ending the entire session.
   *
   * @example
   * ```typescript
   * // Pause when user needs to take another call
   * pauseButton.addEventListener('click', () => {
   *   agent.pause();
   *   console.log('Conversation paused');
   * });
   *
   * // Auto-pause after period of silence
   * let silenceTimeout;
   * agent.on('listening', () => {
   *   silenceTimeout = setTimeout(() => {
   *     agent.pause();
   *     showResumePrompt();
   *   }, 60000); // 1 minute of silence
   * });
   *
   * agent.on('speaking', () => {
   *   clearTimeout(silenceTimeout);
   * });
   *
   * // Listen for pause event
   * agent.on('callPaused', () => {
   *   showPausedIndicator();
   *   disableMicrophone();
   * });
   * ```
   */
  pause(): void {
    if (this.liveKitManager) {
      this.liveKitManager.pause();
      // Release screen wake lock during pause to allow device sleep
      if (this.wakeLockManager?.isActive()) {
        this.wakeLockManager.release().catch((_err) => {
          // Intentionally ignore wake lock release errors
        });
      }
      this.emit('callPaused');
    }
  }

  /**
   * Resumes a paused voice agent conversation
   *
   * Restores audio transmission and reception, continuing the conversation
   * from where it was paused. Re-acquires screen wake lock to prevent
   * device sleep during active conversation.
   *
   * @example
   * ```typescript
   * // Resume when user is ready to continue
   * resumeButton.addEventListener('click', () => {
   *   agent.resume();
   *   console.log('Conversation resumed');
   * });
   *
   * // Resume automatically after user interaction
   * document.addEventListener('click', () => {
   *   if (agent.isPaused) {
   *     agent.resume();
   *   }
   * });
   *
   * // Listen for resume event
   * agent.on('callResumed', () => {
   *   hidePausedIndicator();
   *   enableMicrophone();
   *   showActiveIndicator();
   * });
   * ```
   */
  resume(): void {
    if (this.liveKitManager) {
      this.liveKitManager.resume();
      // Re-acquire screen wake lock during active conversation
      this.wakeLockManager.acquire().catch((_err) => {
        // Intentionally ignore wake lock acquisition errors
      });
      this.emit('callResumed');
    }
  }

  /**
   * Retrieves job details from the Hamsa API using the stored jobId.
   * Implements retry logic with exponential backoff.
   * @param maxRetries - Maximum number of retry attempts.
   * @param initialRetryInterval - Initial delay between retries in milliseconds.
   * @param backoffFactor - Factor by which the retry interval increases each attempt.
   * @returns Job details object.
   */
  async getJobDetails(
    maxRetries = 5,
    initialRetryInterval = 1000,
    backoffFactor = 2
  ): Promise<JobDetails> {
    if (!this.jobId) {
      throw new Error(
        'Cannot fetch job details: jobId is not set. Start a conversation first.'
      );
    }

    if (!this.apiKey) {
      // A call token starts one call and is spent doing it; reading the job
      // afterwards is a server-side job for a real credential.
      throw new Error(
        'Cannot fetch job details without an API key. A call token only starts a call.'
      );
    }

    const url = `${this.API_URL}/v1/voice-agents/conversation/${this.jobId}`;
    const headers = {
      Authorization: `Token ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
    const params = new URLSearchParams({ jobId: this.jobId });

    let currentInterval = initialRetryInterval;

    const fetchJobDetails = async (attempt = 1): Promise<JobDetails> => {
      try {
        const response = await fetch(`${url}?${params.toString()}`, {
          method: 'GET',
          headers,
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `API Error: ${response.status} ${response.statusText} - ${errorText}`
          );
        }
        const data = await response.json();
        // Check if the job status is COMPLETED
        if (data.data.status === 'COMPLETED') {
          return data.data;
        }
        throw new Error(`Job status is not COMPLETED: ${data.data.status}`);
      } catch (error) {
        if (attempt < maxRetries) {
          await this.#delay(currentInterval); // Wait before retrying
          currentInterval *= backoffFactor; // Increase the interval
          return fetchJobDetails(attempt + 1);
        }
        throw new Error(
          `Failed to fetch job details after ${maxRetries} attempts: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    };

    return await fetchJobDetails();
  }

  /**
   * Initializes a LiveKit conversation and gets access token.
   * @private
   * @param voiceAgentId - The voice agent ID.
   * @param params - Additional parameters.
   * @param voiceEnablement - Turns on page tools for the call.
   * @param tools - Array of tools/functions to be used.
   * @returns The LiveKit access token or null if failed.
   */
  /**
   * The `Authorization` header a call starts with: the call token when one is
   * given, otherwise the API key. Neither is an error before any request is
   * made, so a misconfigured page fails with a message rather than a 401.
   */
  #authorizationFor(callToken?: string): string {
    if (callToken) {
      return `CallToken ${callToken}`;
    }
    if (this.apiKey) {
      return `Token ${this.apiKey}`;
    }
    throw new Error(
      'Cannot start a call: no key and no callToken. Pass a publicKey to the constructor, new HamsaVoiceAgent({ publicKey }), or a callToken to start().'
    );
  }

  /**
   * The call token this call starts with: the one given, the one the given
   * function returns (called now, so it is fresh), or one minted with the
   * public key. Undefined when there is none and an API key starts the call.
   */
  async #resolveCallToken(options: {
    agentId: string;
    callToken?: StartOptions['callToken'];
    isChatOnly: boolean;
    callerKey?: string;
    versionRef?: string;
    environmentId?: string;
  }): Promise<string | undefined> {
    const {
      agentId,
      callToken,
      isChatOnly,
      callerKey,
      versionRef,
      environmentId,
    } = options;
    if (typeof callToken === 'function') {
      let token: unknown;
      try {
        token = await callToken();
      } catch (error) {
        throw new Error(
          `Cannot start a call: the callToken function failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      if (typeof token !== 'string' || !token) {
        throw new Error(
          'Cannot start a call: the callToken function returned no token. It should resolve to the callToken your server minted.'
        );
      }
      return token;
    }
    if (callToken) {
      return callToken;
    }
    if (!this.publicKey) {
      return;
    }
    // The key is the environment: nothing the page says can move it.
    if (versionRef || environmentId) {
      throw new HamsaApiError(
        'A public key always runs what its own environment runs, so versionRef and environmentId cannot be used with it. To choose a version or an environment, mint the call token on your server with a secret key.',
        'PublicKeyFixedEnvironment'
      );
    }
    return await this.#mintWithPublicKey({ agentId, isChatOnly, callerKey });
  }

  /**
   * Mints a call token with the public key: for the key's environment, this
   * agent, and (with `callerKey`) the same side of an A/B test every time.
   */
  async #mintWithPublicKey(options: {
    agentId: string;
    isChatOnly: boolean;
    callerKey?: string;
  }): Promise<string> {
    const { agentId, isChatOnly, callerKey } = options;
    this.logger.log('Minting a call token with the public key', {
      source: 'HamsaVoiceAgent',
      error: { agentId, isChatOnly },
    });
    const response = await fetch(`${this.API_URL}/v1/voice-agents/call-token`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${this.publicKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        voiceAgentId: agentId,
        isChatOnly,
        ...(callerKey ? { callerKey } : {}),
      }),
    });
    const text = await response.text();
    let body: {
      message?: string;
      messageKey?: string;
      params?: Record<string, unknown>;
      data?: { callToken?: string };
    } = {};
    try {
      body = JSON.parse(text);
    } catch {
      // Not JSON: the status says what happened.
    }
    if (!response.ok) {
      // No header (or one the browser may not read, cross-origin) is unknown,
      // not 0: Number(null) would tell the page to retry at once.
      const retryHeader = response.headers?.get?.('Retry-After');
      const retryAfter = retryHeader ? Number(retryHeader) : Number.NaN;
      throw new HamsaApiError(
        mintRefusal(body.messageKey, body.params, retryAfter) ??
          body.message ??
          `Could not start the call (${response.status})`,
        body.messageKey,
        {
          status: response.status,
          params: body.params,
          retryAfter: Number.isFinite(retryAfter) ? retryAfter : undefined,
        }
      );
    }
    const token = body.data?.callToken;
    if (!token) {
      throw new HamsaApiError(
        'The call token response had no callToken.',
        undefined,
        { status: response.status }
      );
    }
    return token;
  }

  async #initializeLiveKitConversation(options: {
    authorization: string;
    voiceAgentId: string;
    callerKey?: string;
    versionRef?: string;
    environmentId?: string;
    params: Record<string, unknown>;
    voiceEnablement: boolean;
    tools: Tool[];
    isChatOnly: boolean;
  }): Promise<string> {
    const {
      authorization,
      voiceAgentId,
      callerKey,
      versionRef,
      environmentId,
      params,
      voiceEnablement,
      tools,
      isChatOnly,
    } = options;
    const headers = {
      Authorization: authorization,
      'Content-Type': 'application/json',
    };

    // Step 1: Get LiveKit participant token
    const tokenData = await this.#fetchParticipantToken({
      voiceAgentId,
      params,
      headers,
      isChatOnly,
      versionRef,
      environmentId,
      callerKey,
    });
    const liveKitAccessToken = tokenData.liveKitAccessToken;
    const jobIdFromToken = this.#resolveJobIdFromToken(
      liveKitAccessToken,
      tokenData.jobId,
      voiceAgentId
    );

    // Step 2: Initialize conversation with token
    await this.#initializeConversation({
      voiceAgentId,
      versionRef,
      environmentId,
      params,
      voiceEnablement,
      tools,
      headers,
      jobIdFromToken,
      tokenData,
      isChatOnly,
    });

    // Store resolved jobId for downstream job lookups
    this.jobId = jobIdFromToken;

    return liveKitAccessToken;
  }

  /**
   * Handles API response errors by parsing JSON and creating appropriate HamsaApiError instances
   */
  #handleApiError(
    response: Response,
    errorText: string,
    isTokenEndpoint = false
  ): never {
    // Try to parse JSON error response to extract message and messageKey separately
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.message) {
        // Return both message and messageKey separately for SDK users
        throw new HamsaApiError(
          mintRefusal(errorJson.messageKey, errorJson.params) ??
            errorJson.message,
          errorJson.messageKey,
          { status: response.status, params: errorJson.params }
        );
      }
    } catch (jsonError) {
      // If not JSON or no message field, use the raw error text with status info
      if (jsonError instanceof HamsaApiError) {
        throw jsonError; // Re-throw if it's our custom error
      }
    }

    // For token endpoint, include status info; for conversation endpoint, use raw text
    const errorMessage = isTokenEndpoint
      ? `${response.status} ${response.statusText} - ${errorText}`
      : errorText;

    throw new HamsaApiError(errorMessage, undefined, {
      status: response.status,
    });
  }

  /**
   * Fetches the LiveKit participant token from the API
   */
  async #fetchParticipantToken(options: {
    voiceAgentId: string;
    params: Record<string, unknown>;
    headers: Record<string, string>;
    isChatOnly: boolean;
    versionRef?: string;
    environmentId?: string;
    callerKey?: string;
  }): Promise<{ liveKitAccessToken: string; jobId?: string }> {
    const {
      voiceAgentId,
      params,
      headers,
      isChatOnly,
      versionRef,
      environmentId,
      callerKey,
    } = options;
    this.logger.log('Fetching participant token from API', {
      source: 'HamsaVoiceAgent',
      error: {
        voiceAgentId,
        apiUrl: this.API_URL,
        paramsCount: Object.keys(params).length,
      },
    });

    const startTime = Date.now();
    const tokenResponse = await fetch(
      `${this.API_URL}/v1/voice-agents/room/participant-token`,
      {
        method: 'POST',
        headers,
        // Spread rather than always-present: omitting it keeps the request
        // byte-identical to what every existing caller already sends.
        body: JSON.stringify({
          voiceAgentId,
          params,
          isChatOnly,
          ...(versionRef ? { versionRef } : {}),
          ...(environmentId ? { environmentId } : {}),
          // Only here: conversation-init reuses the version this request chose.
          ...(callerKey ? { callerKey } : {}),
        }),
      }
    );

    const duration = Date.now() - startTime;
    this.logger.log('Received API response for participant token', {
      source: 'HamsaVoiceAgent',
      error: {
        status: tokenResponse.status,
        ok: tokenResponse.ok,
        duration: `${duration}ms`,
      },
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      this.logger.error('API request failed for participant token', {
        source: 'HamsaVoiceAgent',
        error: {
          status: tokenResponse.status,
          statusText: tokenResponse.statusText,
          errorText,
        },
      });
      this.#handleApiError(tokenResponse, errorText, true);
    }

    const tokenResult = await tokenResponse.json();
    if (!(tokenResult?.success && tokenResult?.data?.liveKitAccessToken)) {
      this.logger.error('Invalid token response structure', {
        source: 'HamsaVoiceAgent',
        error: {
          success: tokenResult?.success,
          hasToken: !!tokenResult?.data?.liveKitAccessToken,
        },
      });
      throw new Error('Failed to get LiveKit access token');
    }

    this.logger.log('Successfully received LiveKit access token', {
      source: 'HamsaVoiceAgent',
      error: {
        tokenLength: tokenResult.data.liveKitAccessToken.length,
        hasJobId: !!tokenResult.data.jobId,
        jobId: tokenResult.data.jobId,
      },
    });

    return tokenResult.data;
  }

  /**
   * Initializes the conversation with the backend API
   */
  async #initializeConversation(options: {
    voiceAgentId: string;
    versionRef?: string;
    environmentId?: string;
    params: Record<string, unknown>;
    voiceEnablement: boolean;
    tools: Tool[];
    headers: Record<string, string>;
    jobIdFromToken: string | null;
    tokenData: { jobId?: string };
    isChatOnly: boolean;
  }): Promise<void> {
    const {
      voiceAgentId,
      versionRef,
      environmentId,
      params,
      voiceEnablement,
      tools,
      headers,
      jobIdFromToken,
      tokenData,
      isChatOnly,
    } = options;
    const llmtools =
      tools?.length > 0 ? this.#convertToolsToLLMTools(tools) : [];

    const conversationBody = {
      tools: llmtools,
      voiceEnablement,
      voiceAgentId,
      params,
      // Backend expects jobId derived from the token metadata when available
      jobId: jobIdFromToken ?? tokenData.jobId ?? voiceAgentId,
      // Chat-only sessions must be tagged as a chat channel so the backend agent
      // runs in chat mode (publishes replies on `lk.chat`) and the conversation
      // is recorded under the Chat channel rather than Web.
      channelType: isChatOnly ? 'Chat Agent' : 'Web',
      isChatOnly,
      ...(versionRef ? { versionRef } : {}),
      ...(environmentId ? { environmentId } : {}),
    };

    this.logger.log('Initializing conversation with API', {
      source: 'HamsaVoiceAgent',
      error: {
        voiceAgentId,
        toolsCount: llmtools.length,
        voiceEnablement,
        jobId: conversationBody.jobId,
        channelType: conversationBody.channelType,
        isChatOnly,
      },
    });

    const startTime = Date.now();
    const conversationResponse = await fetch(
      `${this.API_URL}/v1/voice-agents/room/conversation-init`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(conversationBody),
        redirect: 'follow' as RequestRedirect,
      }
    );

    const duration = Date.now() - startTime;
    this.logger.log('Received conversation init response', {
      source: 'HamsaVoiceAgent',
      error: {
        status: conversationResponse.status,
        ok: conversationResponse.ok,
        duration: `${duration}ms`,
      },
    });

    if (!conversationResponse.ok) {
      const errorText = await conversationResponse.text();
      this.logger.error('Conversation initialization failed', {
        source: 'HamsaVoiceAgent',
        error: {
          status: conversationResponse.status,
          statusText: conversationResponse.statusText,
          errorText,
        },
      });
      this.#handleApiError(conversationResponse, errorText, false);
    }

    this.logger.log('Conversation initialized successfully', {
      source: 'HamsaVoiceAgent',
    });
  }

  /**
   * Extracts the jobId value from the LiveKit access token payload metadata.
   * Falls back to the provided endpointJobId or voiceAgentId when unavailable.
   */
  #resolveJobIdFromToken(
    liveKitAccessToken: string,
    endpointJobId: string | undefined,
    voiceAgentId: string
  ): string {
    const TOKEN_PREVIEW_LENGTH = 20;
    this.logger.log('Parsing JWT token for jobId', {
      source: 'HamsaVoiceAgent',
      error: {
        tokenPreview: liveKitAccessToken.substring(0, TOKEN_PREVIEW_LENGTH),
        endpointJobId,
        voiceAgentId,
      },
    });

    try {
      const payload = jwtDecode<LiveKitTokenPayload>(liveKitAccessToken);
      this.logger.log('JWT token parsed successfully', {
        source: 'HamsaVoiceAgent',
        error: {
          hasRoomConfig: !!payload.roomConfig,
          hasAgents: !!payload.roomConfig?.agents,
          agentsCount: payload.roomConfig?.agents?.length ?? 0,
        },
      });

      const agentsMeta = payload?.roomConfig?.agents?.[0]?.metadata;
      if (typeof agentsMeta === 'string') {
        const metaObj = JSON.parse(agentsMeta) as { jobId?: unknown };
        if (typeof metaObj.jobId === 'string' && metaObj.jobId.length > 0) {
          this.logger.log('Extracted jobId from token metadata', {
            source: 'HamsaVoiceAgent',
            error: { jobId: metaObj.jobId },
          });
          return metaObj.jobId;
        }
      }
    } catch (error) {
      this.logger.warn('Failed to parse jobId from token, using fallback', {
        source: 'HamsaVoiceAgent',
        error: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }

    const fallbackJobId = endpointJobId ?? voiceAgentId;
    this.logger.log('Using fallback jobId', {
      source: 'HamsaVoiceAgent',
      error: {
        jobId: fallbackJobId,
        source: endpointJobId ? 'endpoint' : 'voiceAgentId',
      },
    });
    return fallbackJobId;
  }

  /**
   * Converts tools to LLMTools format.
   * @private
   * @param tools - Array of tool objects.
   * @returns Array of LLMTool objects.
   */
  #convertToolsToLLMTools(tools: Tool[]): LLMTool[] {
    return tools.map((item) => {
      const llmTool: LLMTool = {
        type: 'function' as const,
        function: {
          name: item.function_name,
          description: item.description,
          parameters: {
            type: 'object',
            properties:
              item.parameters?.reduce(
                (acc, param) => {
                  acc[param.name] = {
                    type: param.type,
                    description: param.description,
                  };
                  return acc;
                },
                {} as Record<string, { type: string; description: string }>
              ) || {},
            required: item.required || [],
          },
          func_map: item.func_map,
        },
      };

      return llmTool;
    });
  }

  // === Analytics Methods ===

  /**
   * Retrieves current network connection statistics and quality metrics
   *
   * @returns Connection statistics object or null if not connected
   *
   * @example
   * ```typescript
   * const stats = agent.getConnectionStats();
   * if (stats) {
   *   console.log(`Latency: ${stats.latency}ms`);
   *   console.log(`Quality: ${stats.quality}`);
   *   console.log(`Packet Loss: ${stats.packetLoss}%`);
   *
   *   // Show network warning for poor quality
   *   if (stats.quality === 'poor') {
   *     showNetworkWarning(stats);
   *   }
   * }
   * ```
   */
  getConnectionStats(): ConnectionStatsResult | null {
    return this.liveKitManager
      ? this.liveKitManager.getConnectionStats()
      : null;
  }

  /**
   * Retrieves current audio levels and quality metrics for both user and agent
   *
   * @returns Audio metrics object or null if not connected
   *
   * @example
   * ```typescript
   * const audio = agent.getAudioLevels();
   * if (audio) {
   *   // Update UI audio level meters
   *   updateAudioMeter('user', audio.userAudioLevel);
   *   updateAudioMeter('agent', audio.agentAudioLevel);
   *
   *   // Display speaking time statistics
   *   const userMinutes = Math.floor(audio.userSpeakingTime / 60000);
   *   const agentMinutes = Math.floor(audio.agentSpeakingTime / 60000);
   *   console.log(`User spoke for ${userMinutes} minutes`);
   *   console.log(`Agent spoke for ${agentMinutes} minutes`);
   * }
   * ```
   */
  getAudioLevels(): AudioLevelsResult | null {
    return this.liveKitManager ? this.liveKitManager.getAudioLevels() : null;
  }

  /**
   * Retrieves current performance metrics including response times and call duration
   *
   * @returns Performance metrics object or null if not connected
   *
   * @example
   * ```typescript
   * const perf = agent.getPerformanceMetrics();
   * if (perf) {
   *   // Monitor response time for quality assurance
   *   if (perf.responseTime > 3000) {
   *     console.warn('High response time:', perf.responseTime + 'ms');
   *   }
   *
   *   // Display call duration
   *   const minutes = Math.floor(perf.callDuration / 60000);
   *   const seconds = Math.floor((perf.callDuration % 60000) / 1000);
   *   updateTimer(`${minutes}:${seconds.toString().padStart(2, '0')}`);
   * }
   * ```
   */
  getPerformanceMetrics(): PerformanceMetricsResult | null {
    return this.liveKitManager
      ? this.liveKitManager.getPerformanceMetrics()
      : null;
  }

  /**
   * Retrieves information about all participants in the conversation
   *
   * @returns Array of participant data objects (empty array if not connected)
   *
   * @example
   * ```typescript
   * const participants = agent.getParticipants();
   *
   * participants.forEach(participant => {
   *   console.log(`Participant: ${participant.identity}`);
   *   console.log(`Connected: ${new Date(participant.connectionTime)}`);
   *
   *   // Display participant info in UI
   *   if (participant.identity.includes('agent')) {
   *     showAgentStatus('connected', participant.metadata);
   *   }
   * });
   *
   * // Check if agent is present
   * const hasAgent = participants.some(p => p.identity.includes('agent'));
   * ```
   */
  getParticipants(): ParticipantData[] {
    return this.liveKitManager ? this.liveKitManager.getParticipants() : [];
  }

  /**
   * Retrieves current audio track statistics and stream information
   *
   * @returns Track statistics object or null if not connected
   *
   * @example
   * ```typescript
   * const trackStats = agent.getTrackStats();
   * if (trackStats) {
   *   console.log(`Active tracks: ${trackStats.activeTracks}/${trackStats.totalTracks}`);
   *   console.log(`Audio elements: ${trackStats.audioElements}`);
   *
   *   // Check track health
   *   if (trackStats.activeTracks === 0) {
   *     console.warn('No active audio tracks');
   *     showAudioWarning();
   *   }
   * }
   * ```
   */
  getTrackStats(): TrackStatsResult | null {
    return this.liveKitManager ? this.liveKitManager.getTrackStats() : null;
  }

  /**
   * Retrieves comprehensive analytics combining all metrics into a single snapshot
   *
   * This is the primary method for accessing complete conversation analytics,
   * combining connection statistics, audio metrics, performance data, participant
   * information, and track statistics into a unified result.
   *
   * @returns Complete analytics object or null if not connected
   *
   * @example
   * ```typescript
   * const analytics = agent.getCallAnalytics();
   * if (analytics) {
   *   // Log comprehensive conversation summary
   *   console.log('=== Conversation Analytics ===');
   *   console.log(`Duration: ${analytics.performanceMetrics.callDuration}ms`);
   *   console.log(`Quality: ${analytics.connectionStats.quality}`);
   *   console.log(`Latency: ${analytics.connectionStats.latency}ms`);
   *   console.log(`Participants: ${analytics.participants.length}`);
   *
   *   // Send to analytics service
   *   analyticsService.recordConversation({
   *     sessionId: generateSessionId(),
   *     agentId: currentAgentId,
   *     timestamp: Date.now(),
   *     metrics: analytics
   *   });
   *
   *   // Check for quality issues
   *   if (analytics.connectionStats.packetLoss > 5) {
   *     reportNetworkIssue(analytics);
   *   }
   * }
   * ```
   */
  getCallAnalytics(): CallAnalyticsResult | null {
    return this.liveKitManager ? this.liveKitManager.getCallAnalytics() : null;
  }

  /**
   * Gets the LiveKit Room instance for React SDK integration
   *
   * Provides access to the underlying LiveKit Room object for use with
   * LiveKit React components. This enables integration with the broader
   * LiveKit React ecosystem while maintaining the benefits of the
   * HamsaVoiceAgent abstraction.
   *
   * @internal - For use by @hamsa-ai/voice-agents-react only
   * @returns LiveKit Room instance or null if not connected
   *
   * @example React SDK Integration
   * ```typescript
   * import { RoomContext } from '@livekit/components-react';
   *
   * function VoiceProvider({ agent, children }) {
   *   const [room, setRoom] = useState(null);
   *
   *   useEffect(() => {
   *     agent.on('callStarted', () => {
   *       setRoom(agent.getRoom());
   *     });
   *   }, [agent]);
   *
   *   if (!room) return children;
   *
   *   return (
   *     <RoomContext.Provider value={room}>
   *       {children}
   *     </RoomContext.Provider>
   *   );
   * }
   * ```
   */
  getRoom(): Room | null {
    return this.liveKitManager?.connection.getRoom() ?? null;
  }

  /**
   * Gets the remote audio track from the voice agent for visualization
   *
   * Provides access to the agent's audio track for use with LiveKit React
   * visualization components like BarVisualizer. Returns undefined if not
   * connected or no remote audio track is available.
   *
   * @returns RemoteTrack | undefined - The agent's audio track or undefined if not available
   *
   * @example With LiveKit BarVisualizer
   * ```typescript
   * import { BarVisualizer } from '@livekit/components-react';
   *
   * function AgentVisualizer({ agent }) {
   *   const [audioTrack, setAudioTrack] = useState();
   *
   *   useEffect(() => {
   *     agent.on('trackSubscribed', ({ track }) => {
   *       if (track.kind === 'audio') {
   *         setAudioTrack(track);
   *       }
   *     });
   *   }, [agent]);
   *
   *   if (!audioTrack) return null;
   *
   *   return <BarVisualizer trackRef={{ track: audioTrack, source: 'microphone' }} />;
   * }
   * ```
   */
  getRemoteAudioTrack(): RemoteTrack | undefined {
    const room = this.liveKitManager?.connection.getRoom();
    if (!room?.remoteParticipants) {
      return;
    }

    // Find the first remote participant with an audio track
    for (const participant of room.remoteParticipants.values()) {
      const audioPublication = Array.from(
        participant.audioTrackPublications.values()
      )[0];

      if (audioPublication?.track) {
        return audioPublication.track;
      }
    }

    return;
  }

  /**
   * Delays execution for a specified amount of time.
   * @private
   * @param ms - Milliseconds to delay.
   * @returns Promise that resolves after the delay.
   */
  #delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Declaration merging: Add type-safe event methods to HamsaVoiceAgent
 *
 * This interface merges with the HamsaVoiceAgent class to provide fully
 * typed event handler methods without requiring explicit type assertions.
 *
 * @example
 * ```typescript
 * const agent = new HamsaVoiceAgent('api_key');
 *
 * // ✅ Fully type-safe - no casting needed!
 * agent.on('transcriptionReceived', (text) => {
 *   console.log(text); // text is inferred as string
 * });
 *
 * // ❌ Type error - wrong event name
 * agent.on('wrongEvent', () => {});
 *
 * // ❌ Type error - wrong handler signature
 * agent.on('transcriptionReceived', () => {}); // Missing parameter
 * ```
 */
// biome-ignore lint/nursery/useConsistentTypeDefinitions: Interface required for declaration merging with class
interface HamsaVoiceAgent {
  /**
   * Registers an event listener with type-safe event names and handlers
   */
  on<K extends keyof HamsaVoiceAgentEvents>(
    event: K,
    listener: HamsaVoiceAgentEvents[K]
  ): this;

  /**
   * Removes an event listener with type-safe event names and handlers
   */
  off<K extends keyof HamsaVoiceAgentEvents>(
    event: K,
    listener: HamsaVoiceAgentEvents[K]
  ): this;

  /**
   * Registers a one-time event listener with type-safe event names and handlers
   */
  once<K extends keyof HamsaVoiceAgentEvents>(
    event: K,
    listener: HamsaVoiceAgentEvents[K]
  ): this;

  /**
   * Emits an event with type-safe event names and arguments
   */
  emit<K extends keyof HamsaVoiceAgentEvents>(
    event: K,
    ...args: Parameters<HamsaVoiceAgentEvents[K]>
  ): boolean;
}

// Support both named and default exports
export { HamsaVoiceAgent, HamsaApiError };
export default HamsaVoiceAgent;

// Export LiveKit types for use with React components
export type {
  LocalTrack,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
} from 'livekit-client';
// Export types from LiveKitManager directly
export type {
  AudioLevelsResult,
  CallAnalyticsResult,
  ConnectionStatsResult,
  ParticipantData,
  PerformanceMetricsResult,
  TrackStatsResult,
} from './classes/livekit-manager';

// Export event types for type-safe event handling
export type {
  CallStartedData,
  HamsaVoiceAgentEvents,
  StartOptions,
  Tool,
  JobDetails,
};
