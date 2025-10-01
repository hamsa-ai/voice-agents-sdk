import { EventEmitter } from 'events';
import { jwtDecode } from 'jwt-decode';
import type { Room } from 'livekit-client';
import LiveKitManager, {
  type AudioLevelsResult,
  type CallAnalyticsResult,
  type ConnectionStatsResult,
  type ParticipantData,
  type PerformanceMetricsResult,
  type TrackStatsResult,
} from './classes/livekit-manager';
import ScreenWakeLock from './classes/screen-wake-lock';
import type { LiveKitTokenPayload } from './classes/types';

/**
 * Custom error class that includes both human-readable message and machine-readable messageKey
 * for internationalization and programmatic error handling
 */
class HamsaApiError extends Error {
  /** Machine-readable error key for i18n or programmatic handling */
  readonly messageKey?: string;

  constructor(message: string, messageKey?: string) {
    super(message);
    this.name = 'HamsaApiError';
    this.messageKey = messageKey;
  }
}

/**
 * Configuration options for the HamsaVoiceAgent constructor
 * Allows customization of API endpoints and other global settings
 */
type HamsaVoiceAgentConfig = {
  /** Base URL for the Hamsa API. Defaults to 'https://api.tryhamsa.com' */
  API_URL?: string;
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
   * Optional parameters to pass to the agent for conversation customization
   * These can be referenced in agent prompts using {{parameter_name}} syntax
   * @example { userName: "John", orderNumber: "12345", userTier: "premium" }
   */
  params?: Record<string, unknown>;
  /** Whether to enable voice interactions. If false, agent runs in text-only mode */
  voiceEnablement?: boolean;
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
 * HamsaVoiceAgent - Main SDK class for voice agent integration
 *
 * This class provides the primary interface for integrating Hamsa voice agents
 * into web applications. It handles authentication, connection management,
 * conversation lifecycle, analytics, and client-side tool execution.
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
class HamsaVoiceAgent extends EventEmitter {
  /** Default fallback output volume when not connected */
  private static readonly DEFAULT_OUTPUT_VOLUME = 0.0;
  /** Default fallback input volume when not connected */
  private static readonly DEFAULT_INPUT_VOLUME = 0.0;
  /** Internal LiveKit manager instance for WebRTC communication */
  liveKitManager: LiveKitManager | null = null;

  /** Hamsa API key for authentication */
  apiKey: string;

  /** Base URL for Hamsa API endpoints */
  API_URL: string;

  /** Job ID for tracking conversation completion status */
  jobId: string | null = null;

  /** Screen wake lock manager to prevent device sleep during calls */
  wakeLockManager: ScreenWakeLock;

  /** Flag to track if the user initiated the call end */
  // biome-ignore lint/style/useReadonlyClassProperties: userInitiatedEnd is reassigned during call lifecycle
  private userInitiatedEnd = false;

  /**
   * Creates a new HamsaVoiceAgent instance
   *
   * @param apiKey - Your Hamsa API key (get from https://dashboard.tryhamsa.com)
   * @param config - Optional configuration settings
   * @param config.API_URL - Custom API endpoint URL (defaults to https://api.tryhamsa.com)
   *
   * @example
   * ```typescript
   * // Using default API endpoint
   * const agent = new HamsaVoiceAgent('hamsa_api_key_here');
   *
   * // Using custom API endpoint
   * const agent = new HamsaVoiceAgent('hamsa_api_key_here', {
   *   API_URL: 'https://custom-api.example.com'
   * });
   * ```
   *
   * @throws {Error} If apiKey is not provided or invalid
   */
  constructor(
    apiKey: string,
    { API_URL = 'https://api.tryhamsa.com' }: HamsaVoiceAgentConfig = {}
  ) {
    super();
    this.liveKitManager = null;
    this.apiKey = apiKey;
    this.API_URL = API_URL;
    this.jobId = null;
    this.wakeLockManager = new ScreenWakeLock();
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
      // biome-ignore lint/suspicious/noConsole: Tests assert on this log output
      console.log('User activity detected - preventing agent interruption');
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
      // biome-ignore lint/suspicious/noConsole: Tests assert on this log output
      console.log('Sending contextual update:', context);
      // This could be implemented as a special non-conversational message
    }
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
   * @param options.voiceEnablement - Enable voice interactions (default: false for text-only)
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
  async start({
    agentId,
    params = {},
    voiceEnablement = false,
    tools = [],
    userId: _userId,
    preferHeadphonesForIosDevices: _preferHeadphonesForIosDevices = false,
    connectionDelay: _connectionDelay,
    disableWakeLock: _disableWakeLock = false,
  }: StartOptions): Promise<void> {
    try {
      // Reset user-initiated end flag for new call
      this.userInitiatedEnd = false;

      // Get LiveKit access token
      const accessToken = await this.#initializeLiveKitConversation(
        agentId,
        params,
        voiceEnablement,
        tools
      );

      // Create LiveKitManager instance
      this.liveKitManager = new LiveKitManager(
        'wss://rtc.tryhamsa.com',
        accessToken,
        tools
      );

      // Set up event listeners to forward LiveKitManager events
      this.liveKitManager
        .on('error', (error) => this.emit('error', error))
        .on('connected', () => this.emit('start'))
        .on('transcriptionReceived', (transcription) =>
          this.emit('transcriptionReceived', transcription)
        )
        .on('answerReceived', (answer) => this.emit('answerReceived', answer))
        .on('speaking', () => this.emit('speaking'))
        .on('listening', () => this.emit('listening'))
        .on('disconnected', () => {
          // Always emit callEnded when connection ends, regardless of who initiated it
          this.emit('callEnded');
          this.emit('closed');
          // Reset the flag when fully disconnected
          this.userInitiatedEnd = false;
        })
        .on('trackSubscribed', (data) => this.emit('trackSubscribed', data))
        .on('trackUnsubscribed', (data) => this.emit('trackUnsubscribed', data))
        .on('localTrackPublished', (data) =>
          this.emit('localTrackPublished', data)
        )
        .on('info', (info) => this.emit('info', info))

        // Forward new analytics events
        .on('reconnecting', () => this.emit('reconnecting'))
        .on('reconnected', () => this.emit('reconnected'))
        .on('participantConnected', (participant) =>
          this.emit('participantConnected', participant)
        )
        .on('participantDisconnected', (participant) => {
          this.emit('participantDisconnected', participant);

          // Check if this is an agent disconnecting (agent-initiated call end)
          if (
            participant.identity?.includes('agent') &&
            !this.userInitiatedEnd
          ) {
            // Agent ended the call, not the user
            this.emit('callEnded');
          }
        })
        .on('connectionQualityChanged', (data) =>
          this.emit('connectionQualityChanged', data)
        )
        .on('connectionStateChanged', (state) =>
          this.emit('connectionStateChanged', state)
        )
        .on('audioPlaybackChanged', (playing) =>
          this.emit('audioPlaybackChanged', playing)
        )
        .on('analyticsUpdated', (analytics) =>
          this.emit('analyticsUpdated', analytics)
        )
        .on('customEvent', (eventType, eventData, metadata) =>
          this.emit('customEvent', eventType, eventData, metadata)
        )
        .on('dataReceived', (message, participant) =>
          this.emit('dataReceived', message, participant)
        );

      // Connect to LiveKit room
      await this.liveKitManager.connect();

      // Acquire the screen wake lock when the call starts
      try {
        await this.wakeLockManager.acquire();
      } catch {
        // Ignore wake lock acquisition errors
      }
      this.emit('callStarted');
    } catch (error) {
      if (this.listenerCount('error') > 0) {
        // Forward HamsaApiError instances directly to preserve messageKey
        if (error instanceof HamsaApiError) {
          this.emit('error', error);
        } else {
          // For other errors, wrap with context
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.emit(
            'error',
            new Error(`Failed to start call: ${errorMessage}`)
          );
        }
      }
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
    try {
      if (this.liveKitManager) {
        this.userInitiatedEnd = true; // Mark as user-initiated
        this.liveKitManager.disconnect();
        this.emit('callEnded');
      }
      // Release screen wake lock to allow device sleep
      if (this.wakeLockManager?.isActive()) {
        this.wakeLockManager.release().catch((_err) => {
          // Intentionally ignore wake lock release errors
        });
      }
    } catch (error) {
      if (this.listenerCount('error') > 0) {
        // Forward HamsaApiError instances directly to preserve messageKey
        if (error instanceof HamsaApiError) {
          this.emit('error', error);
        } else {
          // For other errors, wrap with context
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.emit('error', new Error(`Failed to end call: ${errorMessage}`));
        }
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
   * @param voiceEnablement - Flag to enable voice features.
   * @param tools - Array of tools/functions to be used.
   * @returns The LiveKit access token or null if failed.
   */
  async #initializeLiveKitConversation(
    voiceAgentId: string,
    params: Record<string, unknown>,
    voiceEnablement: boolean,
    tools: Tool[]
  ): Promise<string> {
    const headers = {
      Authorization: `Token ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    // Step 1: Get LiveKit participant token
    const tokenData = await this.#fetchParticipantToken(
      voiceAgentId,
      params,
      headers
    );
    const liveKitAccessToken = tokenData.liveKitAccessToken;
    const jobIdFromToken = this.#resolveJobIdFromToken(
      liveKitAccessToken,
      tokenData.jobId,
      voiceAgentId
    );

    // Step 2: Initialize conversation with token
    await this.#initializeConversation({
      voiceAgentId,
      params,
      voiceEnablement,
      tools,
      headers,
      jobIdFromToken,
      tokenData,
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
        throw new HamsaApiError(errorJson.message, errorJson.messageKey);
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

    throw new HamsaApiError(errorMessage);
  }

  /**
   * Fetches the LiveKit participant token from the API
   */
  async #fetchParticipantToken(
    voiceAgentId: string,
    params: Record<string, unknown>,
    headers: Record<string, string>
  ): Promise<{ liveKitAccessToken: string; jobId?: string }> {
    const tokenResponse = await fetch(
      `${this.API_URL}/v1/voice-agents/room/participant-token`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ voiceAgentId, params }),
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      this.#handleApiError(tokenResponse, errorText, true);
    }

    const tokenResult = await tokenResponse.json();
    if (!(tokenResult?.success && tokenResult?.data?.liveKitAccessToken)) {
      throw new Error('Failed to get LiveKit access token');
    }

    return tokenResult.data;
  }

  /**
   * Initializes the conversation with the backend API
   */
  async #initializeConversation(options: {
    voiceAgentId: string;
    params: Record<string, unknown>;
    voiceEnablement: boolean;
    tools: Tool[];
    headers: Record<string, string>;
    jobIdFromToken: string | null;
    tokenData: { jobId?: string };
  }): Promise<void> {
    const {
      voiceAgentId,
      params,
      voiceEnablement,
      tools,
      headers,
      jobIdFromToken,
      tokenData,
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
      channelType: 'Web',
    };

    const conversationResponse = await fetch(
      `${this.API_URL}/v1/voice-agents/room/conversation-init`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(conversationBody),
        redirect: 'follow' as RequestRedirect,
      }
    );

    if (!conversationResponse.ok) {
      const errorText = await conversationResponse.text();
      this.#handleApiError(conversationResponse, errorText, false);
    }
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
    try {
      const payload = jwtDecode<LiveKitTokenPayload>(liveKitAccessToken);
      const agentsMeta = payload?.roomConfig?.agents?.[0]?.metadata;
      if (typeof agentsMeta === 'string') {
        const metaObj = JSON.parse(agentsMeta) as { jobId?: unknown };
        if (typeof metaObj.jobId === 'string' && metaObj.jobId.length > 0) {
          return metaObj.jobId;
        }
      }
    } catch {
      // Ignore token parsing errors and fall back
    }
    return endpointJobId ?? voiceAgentId;
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
   * Delays execution for a specified amount of time.
   * @private
   * @param ms - Milliseconds to delay.
   * @returns Promise that resolves after the delay.
   */
  #delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Support both named and default exports
export { HamsaVoiceAgent, HamsaApiError };
export default HamsaVoiceAgent;
