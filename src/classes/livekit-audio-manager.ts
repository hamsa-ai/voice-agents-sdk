/**
 * LiveKitAudioManager - Advanced audio stream management for voice agent communication
 *
 * This class provides comprehensive management of audio streams, tracks, and playback
 * for voice agent conversations. It handles the complex WebRTC audio pipeline including
 * track subscription/unsubscription, HTML audio element management, volume control,
 * and real-time audio activity detection.
 *
 * Key Features:
 * - **Smart Track Management**: Automatic handling of audio track lifecycle
 * - **Dynamic Volume Control**: Real-time volume adjustment across all audio streams
 * - **Audio Activity Detection**: Speaking/listening state detection with events
 * - **Performance Monitoring**: Comprehensive track statistics and analytics
 * - **Robust Error Handling**: Graceful handling of audio playback issues
 * - **Memory Management**: Automatic cleanup of audio resources and DOM elements
 * - **Cross-browser Compatibility**: Works across modern browsers with WebRTC support
 *
 * Audio Pipeline Flow:
 * 1. **Track Subscription**: Incoming audio tracks from voice agents
 * 2. **Element Creation**: HTML audio elements for each track
 * 3. **Volume Application**: Consistent volume across all streams
 * 4. **Activity Monitoring**: Real-time speaking/listening detection
 * 5. **Statistics Collection**: Performance and quality metrics
 * 6. **Cleanup Management**: Proper resource disposal
 *
 * @example Basic Audio Management
 * ```typescript
 * const audioManager = new LiveKitAudioManager();
 *
 * // Set up audio event listeners
 * audioManager.on('trackSubscribed', ({ track, participant }) => {
 *   console.log(`Audio track from ${participant} is now playing`);
 *   showAudioIndicator(participant);
 * });
 *
 * audioManager.on('trackUnsubscribed', ({ participant }) => {
 *   console.log(`Audio track from ${participant} stopped`);
 *   hideAudioIndicator(participant);
 * });
 *
 * audioManager.on('speaking', () => {
 *   showAgentSpeakingIndicator();
 * });
 *
 * audioManager.on('listening', () => {
 *   hideAgentSpeakingIndicator();
 * });
 *
 * // Control volume
 * audioManager.setVolume(0.8);
 * ```
 *
 * @example Volume Control Integration
 * ```typescript
 * // Volume slider integration
 * const volumeSlider = document.getElementById('volume');
 * volumeSlider.addEventListener('input', (e) => {
 *   const volume = parseFloat(e.target.value);
 *   audioManager.setVolume(volume);
 * });
 *
 * // Listen for volume changes
 * audioManager.on('volumeChanged', (newVolume) => {
 *   volumeSlider.value = newVolume.toString();
 *   updateVolumeDisplay(newVolume);
 * });
 *
 * // Mute/unmute functionality
 * muteButton.addEventListener('click', () => {
 *   const currentVolume = audioManager.volume;
 *   audioManager.setVolume(currentVolume > 0 ? 0 : 0.8);
 * });
 * ```
 *
 * @example Audio Statistics Monitoring
 * ```typescript
 * // Monitor audio track statistics
 * const stats = audioManager.getTrackStats();
 * console.log(`Active tracks: ${stats.activeTracks}`);
 * console.log(`Audio elements: ${stats.audioElements}`);
 *
 * // Inspect individual track details
 * stats.trackDetails.forEach(([trackId, data]) => {
 *   console.log(`Track ${trackId}:`);
 *   console.log(`  Participant: ${data.participant}`);
 *   console.log(`  Source: ${data.source}`);
 *   console.log(`  Muted: ${data.muted}`);
 *   console.log(`  Subscription time: ${new Date(data.subscriptionTime)}`);
 * });
 *
 * // Check for audio issues
 * if (stats.activeTracks === 0 && expectedAgentPresent) {
 *   console.warn('No active audio tracks - agent may not be speaking');
 *   showAudioTroubleshootingHint();
 * }
 * ```
 *
 * @example Conversation Flow Control
 * ```typescript
 * // Pause audio during interruptions
 * phoneRinging.addEventListener('ring', () => {
 *   audioManager.pauseAllAudio();
 *   showPausedIndicator();
 * });
 *
 * // Resume when ready
 * phoneRinging.addEventListener('end', () => {
 *   audioManager.resumeAllAudio();
 *   hidePausedIndicator();
 * });
 *
 * // Handle page visibility changes
 * document.addEventListener('visibilitychange', () => {
 *   if (document.hidden) {
 *     audioManager.pauseAllAudio();
 *   } else {
 *     audioManager.resumeAllAudio();
 *   }
 * });
 * ```
 *
 * @example Error Handling
 * ```typescript
 * audioManager.on('error', (error) => {
 *   console.error('Audio error:', error.message);
 *
 *   if (error.message.includes('volume')) {
 *     showVolumeError();
 *   } else if (error.message.includes('track')) {
 *     handleTrackError();
 *     // Audio manager will automatically retry
 *   }
 * });
 *
 * // Monitor for audio playback issues
 * audioManager.on('trackSubscribed', ({ track }) => {
 *   // Set up timeout to detect audio playback issues
 *   setTimeout(() => {
 *     const stats = audioManager.getTrackStats();
 *     if (stats.audioElements === 0) {
 *       console.warn('Audio elements not created - possible browser restriction');
 *       promptUserInteraction();
 *     }
 *   }, 1000);
 * });
 * ```
 *
 * Technical Implementation:
 * - Uses native HTML5 audio elements for cross-browser compatibility
 * - Implements automatic volume normalization across all tracks
 * - Provides real-time audio activity detection through DOM events
 * - Maintains comprehensive track metadata for analytics
 * - Includes robust error handling for browser audio restrictions
 * - Manages DOM element lifecycle to prevent memory leaks
 */

import { EventEmitter } from 'events';
import {
  type LocalTrack,
  type LocalTrackPublication,
  type Participant,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  type Room,
  Track,
  type TrackPublication,
} from 'livekit-client';
import { createDebugLogger, type DebugLogger } from '../utils/debug';
import type {
  AudioCaptureFormat,
  AudioCaptureMetadata,
  AudioCaptureOptions,
  MinimalAnalyser,
  MinimalAudioContext,
  MinimalAudioNode,
  TrackStatsData,
  TrackStatsResult,
  TrackSubscriptionData,
  TrackUnsubscriptionData,
} from './types';

// Audio management configuration constants
/** Maximum allowed volume level */
const MAX_VOLUME = 1.0;
/** Minimum allowed volume level (muted) */
const MIN_VOLUME = 0.0;
/** Default volume level when value is invalid */
const DEFAULT_VOLUME = 0.0;
/** FFT size for analysers */
const ANALYSER_FFT_SIZE = 256;
/** Max byte value for frequency bins */
const BYTE_MAX = 255;

// Audio capture configuration constants
/** Default chunk size for encoded audio capture (milliseconds) */
const DEFAULT_CHUNK_SIZE = 100;
/** Default buffer size for PCM audio capture (samples) - balanced for stability (2048 samp @ 16k = 128ms) */
const DEFAULT_BUFFER_SIZE = 2048;
/** Default audio capture format */
const DEFAULT_AUDIO_FORMAT: AudioCaptureFormat = 'opus-webm';
const DEFAULT_PCM_BUFFER_SIZE = 4096;
/** Scaling factor for converting Float32 audio samples (-1.0 to 1.0) to Int16 (-32768 to 32767) */
const INT16_SCALE = 32_767;

// PCM conversion constants (Reserved for future internal scaling if needed)

/**
 * LiveKitAudioManager class for comprehensive audio stream management
 *
 * Extends EventEmitter to provide real-time audio event notifications and
 * enable reactive audio management in voice agent applications.
 */
export class LiveKitAudioManager extends EventEmitter {
  /** Set of active HTML audio elements currently playing agent audio */
  audioElements: Set<HTMLAudioElement> = new Set();

  /** Map of track statistics and metadata for analytics and monitoring */
  trackStats: Map<string, TrackStatsData> = new Map();

  /** Current volume level for all audio playback (0.0 to 1.0) */
  volume = 1.0;

  /** Reference to LiveKit room for device/mic control (set by manager) */
  private room: Room | null = null;

  /** Optional WebAudio context and analysers (reserved for future use) */
  private audioContext: MinimalAudioContext | null = null;
  // biome-ignore lint/style/useReadonlyClassProperties: These are reassigned during analyser initialization
  private inputAnalyser: MinimalAnalyser | null = null;
  // biome-ignore lint/style/useReadonlyClassProperties: These are reassigned during analyser initialization
  private outputAnalyser: MinimalAnalyser | null = null;

  /** Audio capture state */
  private audioCaptureEnabled = false;
  private audioCaptureOptions: AudioCaptureOptions | null = null;
  private readonly recorders: Map<string, MediaRecorder> = new Map();
  private readonly processors: Map<string, AudioNode> = new Map();
  private readonly sourceNodes: Map<string, MediaStreamAudioSourceNode> =
    new Map();
  /** Map of track IDs to cloned MediaStreamTracks for capture */
  private readonly clonedTracks: Map<string, MediaStreamTrack> = new Map();
  /** Map of track IDs to their capture state */
  private readonly trackCaptureMap: Map<
    string,
    { participant: string; source: 'agent' | 'user' }
  > = new Map();

  /** Debug logger instance for conditional logging */
  private readonly logger: DebugLogger;

  constructor(debug = false) {
    super();
    this.logger = createDebugLogger(debug);
  }

  /**
   * Provides the LiveKit Room to the audio manager for microphone control.
   */
  setRoom(room: Room | null): void {
    this.room = room;
  }

  /**
   * Adjusts the volume level for all active audio streams
   *
   * Sets the playback volume for all currently active audio elements and
   * automatically applies the same volume to any new audio tracks that
   * are subscribed in the future. Volume is normalized to ensure it stays
   * within valid bounds and handles invalid input gracefully.
   *
   * @param volume - Desired volume level (0.0 = muted, 1.0 = full volume)
   *
   * @fires volumeChanged When volume is successfully changed
   * @fires error When volume setting fails
   *
   * @example
   * ```typescript
   * // Set to half volume
   * audioManager.setVolume(0.5);
   *
   * // Mute all audio
   * audioManager.setVolume(0);
   *
   * // Set to maximum volume
   * audioManager.setVolume(1.0);
   *
   * // Listen for volume changes
   * audioManager.on('volumeChanged', (newVolume) => {
   *   console.log(`Volume changed to ${newVolume * 100}%`);
   *   updateVolumeSlider(newVolume);
   * });
   *
   * // Handle volume errors
   * audioManager.on('error', (error) => {
   *   if (error.message.includes('volume')) {
   *     console.error('Failed to change volume:', error.message);
   *   }
   * });
   * ```
   */
  setVolume(volume: number): void {
    try {
      // Normalize and validate volume input
      const numVolume = Number(volume);
      if (Number.isFinite(numVolume)) {
        this.volume = Math.min(MAX_VOLUME, Math.max(MIN_VOLUME, numVolume));
      } else {
        this.volume = DEFAULT_VOLUME;
      }

      // Apply the new volume to all existing audio elements
      for (const audioElement of this.audioElements) {
        if (audioElement && typeof audioElement.volume !== 'undefined') {
          audioElement.volume = this.volume;
        }
      }

      // Notify listeners of the volume change
      this.emit('volumeChanged', this.volume);
    } catch (error) {
      this.emit(
        'error',
        new Error(
          `Failed to set volume: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  /**
   * Gets the current output volume level
   *
   * Returns the current volume setting for audio playback (agent voice output).
   * This is the same value set by setVolume() and represents the playback volume
   * for all voice agent audio streams.
   *
   * @returns Current output volume level (0.0 = muted, 1.0 = full volume)
   *
   * @example
   * ```typescript
   * const currentVolume = audioManager.getOutputVolume();
   * console.log(`Current volume: ${Math.round(currentVolume * 100)}%`);
   *
   * // Check if muted
   * if (currentVolume === 0) {
   *   console.log('Audio is muted');
   * }
   *
   * // Create volume indicator
   * const volumeBars = Math.round(currentVolume * 5);
   * console.log('Volume: ' + '█'.repeat(volumeBars) + '░'.repeat(5 - volumeBars));
   * ```
   */
  getOutputVolume(): number {
    return this.volume;
  }

  /**
   * Gets the current input volume level from the user's microphone
   *
   * Returns the current microphone input level as detected by the audio context.
   * This represents the user's voice input strength and can be used for visual
   * feedback like voice activity indicators or input level meters.
   *
   * Note: This requires an active audio context and microphone stream.
   * Returns 0.0 if no microphone access or audio context is unavailable.
   *
   * @returns Current input volume level (0.0 = no input, 1.0 = maximum input)
   *
   * @example
   * ```typescript
   * // Show user voice activity
   * setInterval(() => {
   *   const inputLevel = audioManager.getInputVolume();
   *   const percentage = Math.round(inputLevel * 100);
   *   updateMicrophoneIndicator(percentage);
   *
   *   // Detect if user is speaking
   *   if (inputLevel > 0.1) {
   *     showUserSpeakingIndicator();
   *   } else {
   *     hideUserSpeakingIndicator();
   *   }
   * }, 100);
   * ```
   */
  getInputVolume(): number {
    try {
      // Lazily initialize input analyser
      if (!this.inputAnalyser) {
        this.#initializeInputAnalyser();
      }

      if (!this.inputAnalyser) {
        return MIN_VOLUME;
      }

      const binCount = this.inputAnalyser.frequencyBinCount;
      const dataArray = new Uint8Array(binCount);
      this.inputAnalyser.getByteFrequencyData(dataArray);
      if (dataArray.length === 0) {
        return MIN_VOLUME;
      }
      let sum = 0;
      for (const v of dataArray) {
        sum += v;
      }
      const avg = sum / (dataArray.length * BYTE_MAX);
      // Clamp 0..1
      return Math.max(MIN_VOLUME, Math.min(MAX_VOLUME, avg));
    } catch {
      return MIN_VOLUME;
    }
  }

  /**
   * Mutes or unmutes the user's microphone
   *
   * Controls the user's microphone input to the voice agent conversation.
   * When muted, the user's voice will not be transmitted to the agent.
   * This is useful for temporary muting during interruptions or background noise.
   *
   * @param muted - True to mute microphone, false to unmute
   *
   * @fires micMuted When microphone is successfully muted
   * @fires micUnmuted When microphone is successfully unmuted
   * @fires error When microphone control fails
   *
   * @example
   * ```typescript
   * // Mute microphone
   * audioManager.setMicMuted(true);
   *
   * // Unmute microphone
   * audioManager.setMicMuted(false);
   *
   * // Toggle microphone state
   * const currentMuted = audioManager.isMicMuted();
   * audioManager.setMicMuted(!currentMuted);
   *
   * // Listen for mute events
   * audioManager.on('micMuted', () => {
   *   showMutedIndicator();
   * });
   *
   * audioManager.on('micUnmuted', () => {
   *   hideMutedIndicator();
   * });
   * ```
   */
  setMicMuted(muted: boolean): void {
    try {
      // If room is available, control the local participant microphone
      if (this.room?.localParticipant) {
        // LiveKit API: setMicrophoneEnabled(true) means unmuted
        const enable = !muted;
        const maybePromise =
          this.room.localParticipant.setMicrophoneEnabled(enable);
        // Handle promise-returning implementations
        if (
          maybePromise &&
          typeof (maybePromise as Promise<void>).then === 'function'
        ) {
          (maybePromise as Promise<void>)
            .then(() => {
              this.#emitMicEventSafely(
                muted ? 'micMuted' : 'micUnmuted',
                muted
              );
            })
            .catch((error) => {
              this.#emitMicControlError(muted, error);
            });
          return;
        }
        // Synchronous path
        this.#emitMicEventSafely(muted ? 'micMuted' : 'micUnmuted', muted);
        return;
      }

      // Fallback: emit events without LiveKit integration
      this.#emitMicEventSafely(muted ? 'micMuted' : 'micUnmuted', muted);
    } catch (error) {
      this.#emitMicControlError(muted, error);
    }
  }

  /**
   * Safely emits mic events and converts internal errors into 'error' events.
   * Prevents exceptions from bubbling to callers.
   */
  #emitMicEventSafely(
    eventName: 'micMuted' | 'micUnmuted',
    muted: boolean
  ): void {
    try {
      this.emit(eventName);
    } catch (error) {
      if (this.listenerCount('error') > 0) {
        this.emit(
          'error',
          new Error(
            `Failed to ${muted ? 'mute' : 'unmute'} microphone: ${error instanceof Error ? error.message : String(error)}`
          )
        );
      }
    }
  }

  /**
   * Checks if the user's microphone is currently muted
   *
   * Returns the current mute state of the user's microphone input.
   * This can be used to display the correct microphone status in the UI.
   *
   * @returns True if microphone is muted, false if unmuted
   *
   * @example
   * ```typescript
   * // Update UI based on microphone state
   * const updateMicButton = () => {
   *   const isMuted = audioManager.isMicMuted();
   *   const micButton = document.getElementById('micButton');
   *   micButton.textContent = isMuted ? '🔇' : '🎤';
   *   micButton.classList.toggle('muted', isMuted);
   * };
   *
   * // Check microphone state before important actions
   * if (audioManager.isMicMuted()) {
   *   showUnmutePrompt('Please unmute to continue conversation');
   * }
   * ```
   */
  isMicMuted(): boolean {
    // Prefer LiveKit local publication mute state when available
    try {
      let publication: { isMuted?: boolean } | undefined;
      const getter = this.room?.localParticipant?.getTrackPublication as
        | ((arg: unknown) => unknown)
        | undefined;
      if (getter) {
        try {
          publication = getter(Track.Source.Microphone) as
            | { isMuted?: boolean }
            | undefined;
        } catch {
          publication = getter('microphone') as
            | { isMuted?: boolean }
            | undefined;
        }
      }
      if (publication && typeof publication.isMuted === 'boolean') {
        return publication.isMuted;
      }
    } catch {
      // Ignore lookup errors and fall back
    }
    // Fallback when state not determinable
    return false;
  }

  /** Emits a standardized error for microphone control failures */
  #emitMicControlError(muted: boolean, error: unknown): void {
    if (this.listenerCount('error') > 0) {
      this.emit(
        'error',
        new Error(
          `Failed to ${muted ? 'mute' : 'unmute'} microphone: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  /**
   * Gets the current input frequency data from the user's microphone
   *
   * Returns frequency domain data for the microphone input as a Uint8Array.
   * This can be used to create audio visualizations, voice activity detection,
   * or advanced audio analysis features.
   *
   * Note: This requires an active audio context and microphone stream.
   * Returns empty array if no microphone access or audio context is unavailable.
   *
   * @returns Uint8Array containing frequency data (0-255 per frequency bin)
   *
   * @example
   * ```typescript
   * // Create audio visualizer
   * const canvas = document.getElementById('audioVisualizer');
   * const ctx = canvas.getContext('2d');
   *
   * function drawVisualizer() {
   *   const frequencyData = audioManager.getInputByteFrequencyData();
   *
   *   ctx.clearRect(0, 0, canvas.width, canvas.height);
   *   const barWidth = canvas.width / frequencyData.length;
   *
   *   for (let i = 0; i < frequencyData.length; i++) {
   *     const barHeight = (frequencyData[i] / 255) * canvas.height;
   *     ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth, barHeight);
   *   }
   *
   *   requestAnimationFrame(drawVisualizer);
   * }
   * drawVisualizer();
   * ```
   */
  getInputByteFrequencyData(): Uint8Array {
    try {
      if (!this.inputAnalyser) {
        this.#initializeInputAnalyser();
      }
      if (!this.inputAnalyser) {
        return new Uint8Array(0);
      }
      const binCount = this.inputAnalyser.frequencyBinCount;
      const dataArray = new Uint8Array(binCount);
      this.inputAnalyser.getByteFrequencyData(dataArray);
      return dataArray;
    } catch {
      return new Uint8Array(0);
    }
  }

  /**
   * Gets the current output frequency data from agent audio
   *
   * Returns frequency domain data for the agent's audio output as a Uint8Array.
   * This can be used to create audio visualizations that show the agent's
   * voice characteristics or for advanced audio processing.
   *
   * Note: This requires active audio playback from the agent.
   * Returns empty array if no agent audio is currently playing.
   *
   * @returns Uint8Array containing frequency data (0-255 per frequency bin)
   *
   * @example
   * ```typescript
   * // Show agent voice characteristics
   * function analyzeAgentVoice() {
   *   const frequencyData = audioManager.getOutputByteFrequencyData();
   *
   *   if (frequencyData.length > 0) {
   *     // Calculate dominant frequency
   *     const maxIndex = frequencyData.indexOf(Math.max(...frequencyData));
   *     const dominantFreq = (maxIndex / frequencyData.length) * 22050; // Assume 44.1kHz sample rate
   *
   *     console.log(`Agent voice dominant frequency: ${dominantFreq}Hz`);
   *     updateVoiceCharacteristics(dominantFreq);
   *   }
   * }
   *
   * // Analyze during agent speech
   * audioManager.on('speaking', () => {
   *   const analysisInterval = setInterval(() => {
   *     analyzeAgentVoice();
   *   }, 100);
   *
   *   audioManager.once('listening', () => {
   *     clearInterval(analysisInterval);
   *   });
   * });
   * ```
   */
  getOutputByteFrequencyData(): Uint8Array {
    try {
      if (!this.outputAnalyser) {
        this.#initializeOutputAnalyser();
      }
      if (!this.outputAnalyser) {
        return new Uint8Array(0);
      }
      const binCount = this.outputAnalyser.frequencyBinCount;
      const dataArray = new Uint8Array(binCount);
      this.outputAnalyser.getByteFrequencyData(dataArray);
      return dataArray;
    } catch {
      return new Uint8Array(0);
    }
  }

  /**
   * Processes new audio track subscriptions from voice agents
   *
   * Handles the complete lifecycle of audio track subscription including HTML
   * audio element creation, volume application, activity monitoring setup,
   * statistics tracking, and DOM management. This method is called automatically
   * by LiveKit when new audio tracks become available.
   *
   * @param track - The LiveKit remote audio track to process
   * @param publication - Track publication metadata from LiveKit
   * @param participant - Participant who owns this audio track
   *
   * @fires trackSubscribed When track is successfully processed and ready for playback
   * @fires speaking When audio playback begins (agent starts talking)
   * @fires listening When audio playback ends (agent stops talking)
   *
   * @example
   * ```typescript
   * // Listen for new audio tracks
   * audioManager.on('trackSubscribed', ({ track, participant, trackStats }) => {
   *   console.log(`Audio track from ${participant} is now available`);
   *
   *   if (participant.includes('agent')) {
   *     showAgentAudioIndicator();
   *     logAudioTrackDetails(trackStats);
   *   }
   * });
   *
   * // Monitor speaking activity
   * audioManager.on('speaking', () => {
   *   console.log('Agent is speaking');
   *   showSpeakingAnimation();
   * });
   *
   * audioManager.on('listening', () => {
   *   console.log('Agent finished speaking');
   *   hideSpeakingAnimation();
   * });
   * ```
   */
  handleTrackSubscribed(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ): void {
    if (track.kind === Track.Kind.Audio) {
      this.#recordTrackStats(track, publication, participant);
      this.#setupAudioElement(track, publication, participant);
      this.#setupAudioCaptureIfEnabled(track, participant);
    }
  }

  /**
   * Processes local audio track publications
   * @param track - The local audio track
   * @param publication - Local track publication metadata
   * @param participant - The local participant who published the track
   */
  handleLocalTrackPublished(
    track: LocalTrack,
    publication: LocalTrackPublication,
    participant: Participant
  ): void {
    if (track.kind === Track.Kind.Audio) {
      this.#recordTrackStats(track, publication, participant);
      this.#setupAudioCaptureIfEnabled(track, participant);
    }
  }

  /**
   * Records track statistics for analytics
   * @private
   */
  #recordTrackStats(
    track: Track,
    publication: TrackPublication,
    participant: Participant
  ): void {
    this.trackStats.set(track.sid || track.mediaStreamTrack?.id || 'unknown', {
      trackId: track.sid || track.mediaStreamTrack?.id || 'unknown',
      kind: track.kind,
      participant: participant.identity || 'unknown',
      subscriptionTime: Date.now(),
      publication,
      source: this.#getTrackSourceString(publication.source),
      muted: publication.isMuted,
      enabled: publication.isEnabled,
      dimensions: publication.dimensions,
      simulcasted: publication.simulcasted,
    });
  }

  /**
   * Sets up audio element for playback and monitoring
   * @private
   */
  #setupAudioElement(
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ): void {
    const audioElement = track.attach() as HTMLAudioElement;
    if (!audioElement) {
      return;
    }

    audioElement.volume = this.volume;
    audioElement.autoplay = true;

    this.#setupAudioMonitoring(audioElement);
    this.audioElements.add(audioElement);

    this.#emitTrackSubscribed(track, publication, participant);
    this.#attachAudioElementToDOM(audioElement);
    this.#setupAudioCaptureIfEnabled(track, participant);
  }

  /**
   * Emits track subscription event
   * @private
   */
  #emitTrackSubscribed(
    track: Track,
    publication: TrackPublication,
    participant: Participant
  ): void {
    const subscriptionData: TrackSubscriptionData = {
      track,
      publication,
      participant: participant.identity || 'unknown',
      trackStats: this.trackStats.get(
        track.sid || track.mediaStreamTrack?.id || 'unknown'
      ),
    };
    this.emit('trackSubscribed', subscriptionData);
  }

  /**
   * Attaches audio element to DOM for playback
   * @private
   */
  #attachAudioElementToDOM(audioElement: HTMLAudioElement): void {
    audioElement.style.display = 'none';
    try {
      document.body.appendChild(audioElement);
    } catch {
      // Ignore DOM attachment errors
    }
  }

  /**
   * Sets up audio capture if enabled for this track
   * @private
   */
  #setupAudioCaptureIfEnabled(track: Track, participant: Participant): void {
    if (!(this.audioCaptureEnabled && this.audioCaptureOptions)) {
      return;
    }

    const trackId = track.sid || track.mediaStreamTrack?.id || 'unknown';
    const isAgent = (participant.identity || '')
      .toLowerCase()
      .includes('agent');
    const trackSource: 'agent' | 'user' = isAgent ? 'agent' : 'user';
    const { source, format, trackSourceFilter } = this.audioCaptureOptions;

    // Check if we should capture this participant's source
    if (source !== 'both' && source !== trackSource) {
      return;
    }

    // Check if we should capture this specific track source
    const actualTrackSource = this.#getTrackSourceString(track.source);
    if (
      trackSourceFilter !== 'all' &&
      trackSourceFilter !== actualTrackSource
    ) {
      return;
    }

    if (format) {
      this.#setupTrackCapture(
        trackId,
        participant.identity || 'unknown',
        trackSource,
        format
      );
    }
  }

  /**
   * Processes audio track unsubscription and cleanup
   *
   * Handles the complete cleanup process when audio tracks from voice agents
   * are unsubscribed, including statistics removal, DOM element cleanup,
   * and event notification. This method is called automatically by LiveKit
   * when audio tracks are no longer available.
   *
   * @param track - The LiveKit remote audio track being unsubscribed
   * @param publication - Track publication metadata from LiveKit
   * @param participant - Participant who owns this audio track
   *
   * @fires trackUnsubscribed When track cleanup is completed successfully
   *
   * @example
   * ```typescript
   * // Listen for track unsubscription events
   * audioManager.on('trackUnsubscribed', ({ participant }) => {
   *   console.log(`Audio track from ${participant} has been removed`);
   *
   *   if (participant.includes('agent')) {
   *     hideAgentAudioIndicator();
   *     updateAudioTrackCount();
   *   }
   * });
   *
   * // Check if any tracks remain active
   * audioManager.on('trackUnsubscribed', () => {
   *   const stats = audioManager.getTrackStats();
   *   if (stats.activeTracks === 0) {
   *     console.log('No active audio tracks remaining');
   *     showNoAudioWarning();
   *   }
   * });
   * ```
   */
  handleTrackUnsubscribed(
    track: Track,
    publication: TrackPublication,
    participant: Participant
  ): void {
    if (track.kind !== Track.Kind.Audio) {
      return;
    }

    this.#cleanupTrackMetadata(track);

    // Remove all attached elements (RemoteTrack only)
    if ('detach' in track && typeof track.detach === 'function') {
      this.#detachTrackElements(track as RemoteTrack);
    }

    // Emit track unsubscription event
    this.emit('trackUnsubscribed', {
      track,
      publication,
      participant: participant.identity || 'unknown',
    } as TrackUnsubscriptionData);
  }

  /**
   * Detaches and removes DOM elements for a track
   * @private
   */
  #detachTrackElements(track: RemoteTrack): void {
    for (const element of track.detach()) {
      try {
        if (element?.parentNode?.removeChild) {
          element.parentNode.removeChild(element);
        }
      } catch {
        // Ignore DOM removal errors
      }

      // Remove element from tracking set
      this.audioElements.delete(element);
    }
  }

  /**
   * Cleans up internal metadata for a track
   * @private
   */
  #cleanupTrackMetadata(track: Track): void {
    this.trackStats.delete(
      track.sid || track.mediaStreamTrack?.id || 'unknown'
    );
  }

  /**
   * Processes local audio track unpublications
   * @param track - The local audio track
   * @param publication - Local track publication metadata
   * @param participant - The local participant who unpublished the track
   */
  handleLocalTrackUnsubscribed(
    track: LocalTrack,
    publication: LocalTrackPublication,
    participant: Participant
  ): void {
    this.handleTrackUnsubscribed(track, publication, participant);
  }

  /**
   * Pauses playback of all active audio streams
   *
   * Temporarily stops playback of all HTML audio elements currently managed
   * by the audio manager. This is typically used during conversation pauses,
   * interruptions, or when the user needs to temporarily halt audio without
   * ending the entire conversation. Audio can be resumed later using resumeAllAudio().
   *
   * @example
   * ```typescript
   * // Pause during phone call interruption
   * phoneCall.addEventListener('incoming', () => {
   *   audioManager.pauseAllAudio();
   *   showPausedIndicator('Incoming call - audio paused');
   * });
   *
   * // Pause when user tabs away (optional behavior)
   * document.addEventListener('visibilitychange', () => {
   *   if (document.hidden) {
   *     audioManager.pauseAllAudio();
   *   }
   * });
   *
   * // Pause during recording
   * startRecordingButton.addEventListener('click', () => {
   *   audioManager.pauseAllAudio();
   *   startUserRecording();
   * });
   *
   * // Manual pause for user control
   * pauseButton.addEventListener('click', () => {
   *   audioManager.pauseAllAudio();
   *   updatePlayPauseButtonState('paused');
   * });
   * ```
   */
  pauseAllAudio(): void {
    for (const audioElement of this.audioElements) {
      if (audioElement.pause) {
        audioElement.pause();
      }
    }
  }

  /**
   * Resumes playback of all paused audio streams
   *
   * Restarts playback of all HTML audio elements that were previously paused
   * by pauseAllAudio(). This method gracefully handles browser audio policies
   * and permission requirements, automatically catching and ignoring play errors
   * that may occur due to user interaction requirements.
   *
   * @example
   * ```typescript
   * // Resume after phone call ends
   * phoneCall.addEventListener('ended', () => {
   *   audioManager.resumeAllAudio();
   *   hidePausedIndicator();
   * });
   *
   * // Resume when user returns to tab
   * document.addEventListener('visibilitychange', () => {
   *   if (!document.hidden) {
   *     audioManager.resumeAllAudio();
   *   }
   * });
   *
   * // Resume after recording ends
   * stopRecordingButton.addEventListener('click', () => {
   *   stopUserRecording();
   *   audioManager.resumeAllAudio();
   * });
   *
   * // Manual resume for user control
   * resumeButton.addEventListener('click', () => {
   *   audioManager.resumeAllAudio();
   *   updatePlayPauseButtonState('playing');
   * });
   *
   * // Handle browser audio policy restrictions
   * userInteractionButton.addEventListener('click', () => {
   *   // Browser requires user interaction for audio playback
   *   audioManager.resumeAllAudio();
   * });
   * ```
   */
  resumeAllAudio(): void {
    for (const audioElement of this.audioElements) {
      if (audioElement.play) {
        audioElement.play().catch(() => {
          // Ignore audio play errors
        });
      }
    }
  }

  /**
   * Retrieves comprehensive statistics about all active audio tracks
   *
   * Provides detailed information about the current state of audio track management,
   * including counts of active tracks, HTML audio elements, and detailed metadata
   * for each track. This method is essential for monitoring audio system health,
   * debugging audio issues, and providing analytics data.
   *
   * @returns Complete track statistics including counts and detailed track information
   *
   * @example Basic Statistics Monitoring
   * ```typescript
   * const stats = audioManager.getTrackStats();
   *
   * // Display basic track information
   * console.log(`Active tracks: ${stats.activeTracks}`);
   * console.log(`Total tracks processed: ${stats.totalTracks}`);
   * console.log(`HTML audio elements: ${stats.audioElements}`);
   *
   * // Update UI indicators
   * updateTrackCountDisplay(stats.activeTracks);
   * updateAudioElementCount(stats.audioElements);
   *
   * // Check system health
   * if (stats.activeTracks === 0 && expectedAgentPresent) {
   *   showNoAudioTracksWarning();
   * }
   * ```
   *
   * @example Detailed Track Analysis
   * ```typescript
   * const stats = audioManager.getTrackStats();
   *
   * // Analyze each track in detail
   * stats.trackDetails.forEach(([trackId, trackData]) => {
   *   console.log(`\n--- Track ${trackId} ---`);
   *   console.log(`Participant: ${trackData.participant}`);
   *   console.log(`Source: ${trackData.source}`);
   *   console.log(`Muted: ${trackData.muted}`);
   *   console.log(`Enabled: ${trackData.enabled}`);
   *   console.log(`Subscription time: ${new Date(trackData.subscriptionTime)}`);
   *
   *   if (trackData.dimensions) {
   *     console.log(`Dimensions: ${trackData.dimensions.width}x${trackData.dimensions.height}`);
   *   }
   *
   *   // Check track health
   *   if (trackData.muted) {
   *     logTrackIssue('muted_track', trackData);
   *   }
   * });
   * ```
   *
   * @example Dashboard Integration
   * ```typescript
   * // Real-time dashboard updates
   * setInterval(() => {
   *   const stats = audioManager.getTrackStats();
   *
   *   updateDashboard({
   *     activeAudioTracks: stats.activeTracks,
   *     audioElements: stats.audioElements,
   *     trackHealth: stats.activeTracks > 0 ? 'healthy' : 'no_audio',
   *     lastUpdated: Date.now()
   *   });
   * }, 1000);
   *
   * // Alert on track count changes
   * let lastTrackCount = 0;
   * const checkTrackChanges = () => {
   *   const stats = audioManager.getTrackStats();
   *   if (stats.activeTracks !== lastTrackCount) {
   *     console.log(`Track count changed: ${lastTrackCount} → ${stats.activeTracks}`);
   *     lastTrackCount = stats.activeTracks;
   *
   *     if (stats.activeTracks === 0) {
   *       notifyUser('Audio tracks disconnected');
   *     }
   *   }
   * };
   * ```
   *
   * @example Audio Quality Monitoring
   * ```typescript
   * const stats = audioManager.getTrackStats();
   *
   * // Check for potential audio issues
   * const currentTime = Date.now();
   * const audioIssues = [];
   *
   * stats.trackDetails.forEach(([trackId, data]) => {
   *   // Check if track has been muted for too long
   *   if (data.muted) {
   *     audioIssues.push(`Track ${trackId} is muted`);
   *   }
   *
   *   // Check if track is old (potential stale connection)
   *   const trackAge = currentTime - data.subscriptionTime;
   *   if (trackAge > 300000) { // 5 minutes
   *     audioIssues.push(`Track ${trackId} is ${Math.round(trackAge/60000)}m old`);
   *   }
   * });
   *
   * // Report issues
   * if (audioIssues.length > 0) {
   *   console.warn('Audio issues detected:', audioIssues);
   *   reportAudioQualityIssues(audioIssues);
   * }
   * ```
   */
  getTrackStats(): TrackStatsResult {
    return {
      totalTracks: this.trackStats.size, // Current active tracks as total
      activeTracks: this.trackStats.size,
      audioElements: this.audioElements.size,
      trackDetails: Array.from(this.trackStats.entries()),
    };
  }

  /**
   * Configures real-time audio activity detection for speaking/listening events
   *
   * Sets up event listeners on HTML audio elements to detect when the voice agent
   * starts and stops speaking. This enables real-time conversation flow tracking
   * and UI updates for speaking indicators, conversation analytics, and user experience
   * enhancements. The monitoring uses native HTML5 audio events for accurate detection.
   *
   * @param audioElement - HTML audio element to monitor for speaking activity
   *
   * @private
   *
   * @example Internal Usage (called automatically by handleTrackSubscribed)
   * ```typescript
   * // This method is called internally when new audio tracks are subscribed
   * // It sets up the following event flow:
   *
   * audioElement.addEventListener('play', () => {
   *   // Agent starts speaking → emit 'speaking' event
   * });
   *
   * audioElement.addEventListener('pause', () => {
   *   // Agent stops speaking → emit 'listening' event
   * });
   *
   * audioElement.addEventListener('ended', () => {
   *   // Audio stream ends → emit 'listening' event
   * });
   * ```
   *
   * Technical Implementation:
   * - Tracks speaking state to prevent duplicate event emission
   * - Uses native HTML5 audio events for reliable detection
   * - Automatically handles speaking state transitions
   * - Emits standardized 'speaking' and 'listening' events
   * - Provides foundation for conversation analytics
   */
  #setupAudioMonitoring(audioElement: HTMLAudioElement): void {
    let isCurrentlySpeaking = false;

    audioElement.addEventListener('play', () => {
      if (!isCurrentlySpeaking) {
        isCurrentlySpeaking = true;
        this.emit('speaking');
      }
    });

    audioElement.addEventListener('pause', () => {
      isCurrentlySpeaking = false;
      this.emit('listening');
    });

    audioElement.addEventListener('ended', () => {
      isCurrentlySpeaking = false;
      this.emit('listening');
    });
  }

  /** Initializes WebAudio AudioContext if available */
  #ensureAudioContext(): void {
    if (this.audioContext) {
      return;
    }

    const AudioContextCtor = (globalThis.AudioContext ||
      (globalThis as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext) as {
      new (options?: AudioContextOptions): AudioContext;
    };

    if (typeof AudioContextCtor !== 'function') {
      return;
    }

    try {
      // Force 16kHz to match voice agent requirements across all features
      const ctx = new AudioContextCtor({
        sampleRate: 16_000,
      });

      this.audioContext = ctx as unknown as MinimalAudioContext;

      // Auto-resume to avoid "suspended" state issues on initialization
      if (ctx.state === 'suspended') {
        ctx.resume().catch((err) => {
          this.logger.warn('Failed to auto-resume AudioContext:', {
            source: 'LiveKitAudioManager',
            error: err,
          });
        });
      }
    } catch {
      // Fallback for browsers that don't support sampleRate option or 16k
      try {
        this.audioContext =
          new AudioContextCtor() as unknown as MinimalAudioContext;
      } catch {
        this.audioContext = null;
      }
    }
  }

  /**
   * Gets or creates the internal mixer node for combined audio capture
   * @private
   */

  /** Initialize analyser for microphone (input) if possible */
  #initializeInputAnalyser(): void {
    try {
      this.#ensureAudioContext();
      if (!this.audioContext) {
        return;
      }
      let publication: unknown = null;
      const getter = this.room?.localParticipant?.getTrackPublication as
        | ((arg: unknown) => unknown)
        | undefined;
      if (getter) {
        try {
          publication = getter(Track.Source.Microphone);
        } catch {
          publication = getter('microphone');
        }
      }
      const mediaTrack = (
        publication as {
          track?: { mediaStreamTrack?: MediaStreamTrack };
        } | null
      )?.track?.mediaStreamTrack;
      if (!mediaTrack) {
        return;
      }
      const stream = new MediaStream([mediaTrack]);
      const source = this.audioContext.createMediaStreamSource(stream);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = ANALYSER_FFT_SIZE;
      {
        const node = source as unknown as MinimalAudioNode;
        if (node && typeof node.connect === 'function') {
          node.connect(analyser);
        }
      }
      this.inputAnalyser = analyser;
    } catch {
      this.inputAnalyser = null;
    }
  }

  /** Initialize analyser for first output audio element if possible */
  #initializeOutputAnalyser(): void {
    try {
      this.#ensureAudioContext();
      if (!this.audioContext) {
        return;
      }
      const first = this.audioElements.values().next().value as
        | HTMLAudioElement
        | undefined;
      if (!first) {
        return;
      }
      const source = this.audioContext.createMediaElementSource(first);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = ANALYSER_FFT_SIZE;
      {
        const node = source as unknown as MinimalAudioNode;
        if (node && typeof node.connect === 'function') {
          node.connect(analyser);
        }
      }
      this.outputAnalyser = analyser;
    } catch {
      this.outputAnalyser = null;
    }
  }

  /**
   * Converts LiveKit Track.Source enum values to human-readable strings
   *
   * Transforms LiveKit's internal Track.Source enum values into descriptive
   * string representations for logging, analytics, and user interface display.
   * This mapping ensures consistent string representation of track sources
   * across the application.
   *
   * @param source - LiveKit Track.Source enum value
   * @returns Human-readable string representation of the track source
   *
   * @private
   *
   * @example Internal Usage
   * ```typescript
   * // Called internally during track subscription
   * const sourceString = this.#getTrackSourceString(publication.source);
   * // Possible returns: 'microphone', 'camera', 'screen_share', 'screen_share_audio', 'unknown'
   *
   * // Used in track statistics and logging
   * console.log(`Track source: ${sourceString}`);
   * analyticsData.trackSource = sourceString;
   * ```
   *
   * Supported source mappings:
   * - Track.Source.Microphone → 'microphone'
   * - Track.Source.Camera → 'camera'
   * - Track.Source.ScreenShare → 'screen_share'
   * - Track.Source.ScreenShareAudio → 'screen_share_audio'
   * - Unknown sources → 'unknown'
   */
  #getTrackSourceString(source: Track.Source): string {
    // biome-ignore lint/nursery/noUnnecessaryConditions: switch statement is necessary for enum mapping
    switch (source) {
      case Track.Source.Microphone:
        return 'microphone';
      case Track.Source.Camera:
        return 'camera';
      case Track.Source.ScreenShare:
        return 'screen_share';
      case Track.Source.ScreenShareAudio:
        return 'screen_share_audio';
      default:
        return 'unknown';
    }
  }

  /**
   * Performs comprehensive cleanup of all audio resources and DOM elements
   *
   * Safely removes all HTML audio elements from the DOM, clears internal data
   * structures, and resets the audio manager to its initial state. This method
   * is essential for preventing memory leaks and ensuring proper resource
   * management when disconnecting or reinitializing the audio system.
   *
   * Cleanup operations performed:
   * - Removes all HTML audio elements from DOM
   * - Clears the audioElements Set
   * - Resets all track statistics and metadata
   * - Gracefully handles DOM manipulation errors
   *
   * @example Manual Cleanup
   * ```typescript
   * // Explicit cleanup when component unmounts
   * useEffect(() => {
   *   return () => {
   *     audioManager.cleanup();
   *     console.log('Audio manager cleaned up');
   *   };
   * }, []);
   *
   * // Cleanup before reinitializing with new configuration
   * const reinitializeAudio = () => {
   *   audioManager.cleanup();
   *   audioManager = new LiveKitAudioManager();
   *   setupAudioEventListeners();
   * };
   * ```
   *
   * @example Cleanup Verification
   * ```typescript
   * // Verify cleanup completed successfully
   * audioManager.cleanup();
   *
   * const stats = audioManager.getTrackStats();
   * console.assert(stats.activeTracks === 0, 'All tracks should be cleaned up');
   * console.assert(stats.audioElements === 0, 'All audio elements should be removed');
   * console.assert(audioManager.audioElements.size === 0, 'Audio elements set should be empty');
   * ```
   *
   * @example Error-Safe Cleanup
   * ```typescript
   * // Cleanup is safe to call multiple times
   * audioManager.cleanup(); // First cleanup
   * audioManager.cleanup(); // Safe to call again
   *
   * // Cleanup is safe even if DOM elements are already removed
   * document.body.innerHTML = ''; // Clear all DOM
   * audioManager.cleanup(); // Still safe to call
   * ```
   */
  /**
   * Enables audio capture with specified options
   *
   * This method sets up audio capture from the agent, user, or both, allowing
   * clients to receive raw audio data for forwarding to third-party services,
   * recording, or custom processing.
   *
   * @param options - Configuration options for audio capture
   *
   * @example Capture agent audio in Opus format
   * ```typescript
   * audioManager.enableAudioCapture({
   *   source: 'agent',
   *   format: 'opus-webm',
   *   chunkSize: 100,
   *   callback: (audioData, metadata) => {
   *     console.log(`Audio from ${metadata.participant}:`, audioData.byteLength, 'bytes');
   *     sendToThirdParty(audioData);
   *   }
   * });
   * ```
   *
   * @example Capture both user and agent in PCM format
   * ```typescript
   * audioManager.enableAudioCapture({
   *   source: 'both',
   *   format: 'pcm-f32',
   *   bufferSize: 4096,
   *   callback: (audioData, metadata) => {
   *     if (metadata.source === 'agent') {
   *       processAgentAudio(audioData as Float32Array);
   *     } else {
   *       processUserAudio(audioData as Float32Array);
   *     }
   *   }
   * });
   * ```
   */
  enableAudioCapture(options: AudioCaptureOptions): void {
    // Support both 'callback' and 'onData' for flexibility
    const callback = options.callback || options.onData;

    if (!callback) {
      throw new Error(
        'Audio capture requires either "callback" or "onData" option'
      );
    }

    this.audioCaptureEnabled = true;
    this.audioCaptureOptions = {
      source: options.source || 'agent',
      trackSourceFilter: options.trackSourceFilter || 'microphone',
      format: options.format || DEFAULT_AUDIO_FORMAT,
      chunkSize: options.chunkSize || DEFAULT_CHUNK_SIZE,
      bufferSize: options.bufferSize || DEFAULT_BUFFER_SIZE,
      callback,
    };

    // Set up capture for existing tracks
    this.#setupExistingTrackCapture();
  }

  /**
   * Internal state for AudioWorklet registration to prevent race conditions
   * @private
   */
  private workletReady: Promise<void> | null = null;

  /**
   * Disables audio capture and cleans up all capture resources
   *
   * Stops all active MediaRecorders and ScriptProcessorNodes, releases
   * audio capture resources, and clears capture state.
   *
   * @example
   * ```typescript
   * // Stop capturing audio
   * audioManager.disableAudioCapture();
   * ```
   */
  disableAudioCapture(): void {
    this.audioCaptureEnabled = false;
    this.#cleanupAudioCapture();
    this.audioCaptureOptions = null;
    this.workletReady = null;
  }

  /**
   * Sets up audio capture for existing tracks
   * @private
   */
  #setupExistingTrackCapture(): void {
    if (!this.audioCaptureOptions) {
      return;
    }

    const { source, format, trackSourceFilter } = this.audioCaptureOptions;

    if (!format) {
      return;
    }

    // Set up capture for already-subscribed tracks
    for (const [trackId, trackData] of this.trackStats.entries()) {
      const isAgent = trackData.participant.toLowerCase().includes('agent');
      const trackSource: 'agent' | 'user' = isAgent ? 'agent' : 'user';

      // Check if we should capture this participant's source
      if (source !== 'both' && source !== trackSource) {
        continue;
      }

      // Check if we should capture this specific track source
      const actualTrackSource = trackData.source;
      if (
        trackSourceFilter !== 'all' &&
        trackSourceFilter !== actualTrackSource
      ) {
        continue;
      }

      this.#setupTrackCapture(
        trackId,
        trackData.participant,
        trackSource,
        format
      );
    }
  }

  /**
   * Sets up audio capture for a specific track
   * @private
   */
  #setupTrackCapture(
    trackId: string,
    participant: string,
    source: 'agent' | 'user',
    format: AudioCaptureFormat
  ): void {
    if (!this.audioCaptureOptions) {
      return;
    }

    // Get the track from LiveKit room
    const track = this.#getTrackById(trackId);
    if (!track?.mediaStreamTrack) {
      return;
    }

    // Prevent duplicate capture setup for the same track
    if (this.trackCaptureMap.has(trackId)) {
      this.logger.log(`Skipping duplicate setup for ${source} (${trackId})`, {
        source: 'LiveKitAudioManager',
      });
      return;
    }

    // Store capture metadata
    const trackSource = this.#getTrackSourceString(track.source);
    this.trackCaptureMap.set(trackId, { participant, source });

    // CRITICAL FIX: Clone the track to avoid resource contention
    // Using the same track for both playback and capture causes choppy audio
    const clonedTrack = track.mediaStreamTrack.clone();
    const stream = new MediaStream([clonedTrack]);

    // Store the cloned track so we can stop it during cleanup
    this.clonedTracks.set(trackId, clonedTrack);

    if (format === 'opus-webm') {
      this.#setupEncodedCapture({
        stream,
        trackId,
        participant,
        source,
        trackSource,
      });
    } else {
      this.#setupPCMCapture({
        stream,
        trackId,
        participant,
        source,
        format,
        trackSource,
      });
    }
  }

  /**
   * Initializes a single capture session for the combined mixer stream
   * @private
   */

  /**
   * Sets up encoded audio capture using MediaRecorder
   * @private
   */
  #setupEncodedCapture(options: {
    stream: MediaStream;
    trackId: string;
    participant: string;
    source: 'agent' | 'user';
    trackSource: string;
  }): void {
    const { stream, trackId, participant, source, trackSource } = options;
    if (!this.audioCaptureOptions?.callback) {
      return;
    }

    const { chunkSize, callback } = this.audioCaptureOptions;

    try {
      const mimeType = this.#getSupportedMimeType();
      const recorderOptions: MediaRecorderOptions = mimeType
        ? { mimeType }
        : {};

      const recorder = new MediaRecorder(stream, recorderOptions);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          event.data.arrayBuffer().then((buffer) => {
            const metadata: AudioCaptureMetadata = {
              participant,
              source: source as 'agent' | 'user',
              timestamp: Date.now(),
              trackId,
              trackSource,
              format: 'opus-webm',
            };
            callback(buffer, metadata);
          });
        }
      };

      recorder.start(chunkSize);

      // Store recorder reference
      this.recorders.set(trackId, recorder);
    } catch (error) {
      this.emit(
        'error',
        new Error(
          `Failed to setup encoded audio capture: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  /**
   * Sets up PCM audio capture using Web Audio API
   * @private
   */
  #setupPCMCapture(options: {
    stream: MediaStream;
    trackId: string;
    participant: string;
    source: 'agent' | 'user';
    format: AudioCaptureFormat;
    trackSource: string;
  }): void {
    const { stream, trackId, participant, source, format, trackSource } =
      options;

    if (!this.audioCaptureOptions?.callback) {
      return;
    }

    const { callback } = this.audioCaptureOptions;
    const bufferSize =
      this.audioCaptureOptions.bufferSize || DEFAULT_PCM_BUFFER_SIZE;

    try {
      this.#ensureAudioContext();
      if (!this.audioContext) {
        throw new Error('WebAudio is not supported in this environment');
      }

      const audioContext = this.audioContext as unknown as AudioContext;

      // Resume AudioContext if suspended (browser autoplay policy)
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {
          // Ignore resume errors, will try again on next user interaction if possible
          // or fail silently if policy is strict
        });
      }

      // Try AudioWorklet first (modern, off-main-thread)
      if (
        audioContext.audioWorklet &&
        typeof audioContext.audioWorklet.addModule === 'function'
      ) {
        this.#setupAudioWorkletCapture({
          audioContext,
          stream,
          trackId,
          participant,
          source,
          trackSource,
          format,
          bufferSize,
          callback,
        });
        return;
      }

      // Fallback to ScriptProcessorNode (legacy, main-thread)
      this.#setupScriptProcessorCapture({
        audioContext,
        stream,
        trackId,
        participant,
        source,
        trackSource,
        format,
        bufferSize,
        callback,
      });
    } catch (error) {
      this.emit(
        'error',
        new Error(
          `Failed to setup PCM audio capture: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  /**
   * Sets up AudioWorklet-based PCM capture (Modern API)
   * @private
   */
  async #setupAudioWorkletCapture(options: {
    audioContext: AudioContext;
    stream: MediaStream;
    trackId: string;
    participant: string;
    source: 'agent' | 'user';
    trackSource: string;
    format: AudioCaptureFormat;
    bufferSize: number;
    callback: (
      data: Float32Array | Int16Array,
      metadata: AudioCaptureMetadata
    ) => void;
  }): Promise<void> {
    const {
      audioContext,
      stream,
      trackId,
      participant,
      source,
      trackSource,
      format,
      bufferSize,
      callback,
    } = options;

    try {
      // Ensure worklet is registered exactly once (prevents errors on multiple source setup)
      if (!this.workletReady) {
        this.workletReady = (async () => {
          // Inline AudioWorkletProcessor code with internal buffering
          const workletCode = `
            class PCMProcessor extends AudioWorkletProcessor {
              constructor(options) {
                super();
                this.bufferSize = options.processorOptions.bufferSize || ${DEFAULT_PCM_BUFFER_SIZE};
                this.buffer = new Float32Array(this.bufferSize);
                this.index = 0;
              }

              process(inputs, outputs, parameters) {
                const input = inputs[0];
                if (!input || !input.length) return true;

                const channelData = input[0];
                if (!channelData) return true;

                for (let i = 0; i < channelData.length; i++) {
                  this.buffer[this.index++] = channelData[i];

                  if (this.index >= this.bufferSize) {
                    const bufferToSend = this.buffer.slice(0, this.bufferSize);
                    this.index = 0;
                    this.port.postMessage(bufferToSend, [bufferToSend.buffer]);
                  }
                }
                
                return true;
              }
            }
            registerProcessor('pcm-processor', PCMProcessor);
          `;

          const blob = new Blob([workletCode], {
            type: 'application/javascript',
          });
          const url = URL.createObjectURL(blob);
          await audioContext.audioWorklet.addModule(url);
          URL.revokeObjectURL(url);
        })();
      }

      // Wait for registration if it's in progress
      await this.workletReady;

      const sourceNode = audioContext.createMediaStreamSource(stream);

      const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor', {
        processorOptions: {
          bufferSize,
        },
      });

      workletNode.port.onmessage = (event) => {
        const audioData = event.data as Float32Array;
        const outputData =
          format === 'pcm-i16' ? this.#float32ToInt16(audioData) : audioData;

        const metadata: AudioCaptureMetadata = {
          participant,
          source,
          timestamp: Date.now(),
          trackId,
          trackSource,
          format,
          sampleRate: audioContext.sampleRate,
          channels: 1,
        };

        try {
          callback(outputData, metadata);
        } catch (err) {
          this.logger.error(`Callback error for ${source}:`, {
            source: 'LiveKitAudioManager',
            error: err,
          });
        }
      };

      // Error handler for worklet processor
      workletNode.onprocessorerror = (event) => {
        this.logger.error(
          `Worklet processor error for ${source} (${trackId}):`,
          {
            source: 'LiveKitAudioManager',
            error: event,
          }
        );
      };

      sourceNode.connect(workletNode);

      // Store nodes to prevent garbage collection FIRST
      this.sourceNodes.set(trackId, sourceNode as MediaStreamAudioSourceNode);
      this.processors.set(trackId, workletNode);

      // CRITICAL: Connect to destination to keep worklet alive
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      workletNode.connect(silentGain);
      silentGain.connect(audioContext.destination);
      this.processors.set(`${trackId}_gain`, silentGain);
    } catch (error) {
      this.logger.error(`AudioWorklet setup failed for ${source}:`, {
        source: 'LiveKitAudioManager',
        error,
      });

      this.workletReady = null; // Allow retry on failure
      this.#setupScriptProcessorCapture(options);
    }
  }

  /**
   * Sets up ScriptProcessorNode-based PCM capture (Legacy Fallback)
   * @private
   */
  #setupScriptProcessorCapture(options: {
    audioContext: AudioContext;
    stream: MediaStream;
    trackId: string;
    participant: string;
    source: 'agent' | 'user';
    trackSource: string;
    format: AudioCaptureFormat;
    bufferSize: number;
    callback: (
      data: Float32Array | Int16Array,
      metadata: AudioCaptureMetadata
    ) => void;
  }): void {
    const {
      audioContext,
      stream,
      trackId,
      participant,
      source,
      trackSource,
      format,
      bufferSize,
      callback,
    } = options;

    try {
      const sourceNode = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);

      processor.onaudioprocess = (e) => {
        const inputBuffer = e.inputBuffer;
        const audioData = inputBuffer.getChannelData(0);
        const outputData =
          format === 'pcm-i16'
            ? this.#float32ToInt16(audioData)
            : new Float32Array(audioData);

        const metadata: AudioCaptureMetadata = {
          participant,
          source: source as 'agent' | 'user',
          timestamp: Date.now(),
          trackId,
          trackSource,
          format,
          sampleRate: inputBuffer.sampleRate,
          channels: inputBuffer.numberOfChannels,
        };

        callback(outputData, metadata);
      };

      sourceNode.connect(processor);

      // CRITICAL: Prevent GC by storing references
      this.sourceNodes.set(trackId, sourceNode);
      this.processors.set(trackId, processor);

      // Some browsers require connection to destination to drive processing,
      // but we use a silent gain to prevent double audio.
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      processor.connect(silentGain);
      silentGain.connect(audioContext.destination);

      // Also store the gain node to prevent GC
      this.processors.set(`${trackId}_gain`, silentGain);
    } catch (error) {
      this.logger.error(`ScriptProcessor setup failed for ${source}:`, {
        source: 'LiveKitAudioManager',
        error,
      });
    }
  }

  /**
   * Gets a track by its ID
   * @private
   */
  #getTrackById(trackId: string): RemoteTrack | LocalTrack | null {
    if (!this.room) {
      return null;
    }

    // Check remote tracks
    for (const participant of Array.from(
      this.room.remoteParticipants.values()
    )) {
      // Iterate all publications and check track SID or mediaStreamTrack ID
      for (const pub of Array.from(participant.trackPublications.values())) {
        if (
          pub.track?.sid === trackId ||
          pub.track?.mediaStreamTrack?.id === trackId
        ) {
          return pub.track;
        }
      }
    }

    // Check local tracks
    if (this.room.localParticipant) {
      // Iterate all publications and check track SID or mediaStreamTrack ID
      for (const publication of Array.from(
        this.room.localParticipant.trackPublications.values()
      )) {
        if (
          publication.track?.sid === trackId ||
          publication.track?.mediaStreamTrack?.id === trackId
        ) {
          return publication.track;
        }
      }
    }

    return null;
  }

  /**
   * Cleans up all audio capture resources
   * @private
   */
  #cleanupAudioCapture(): void {
    this.workletReady = null;
    // Stop and clean up MediaRecorders
    for (const recorder of this.recorders.values()) {
      try {
        recorder.stop();
      } catch {
        // Ignore errors
      }
    }
    this.recorders.clear();

    // Disconnect and clean up all processors (Worklets, ScriptProcessors, GainNodes)
    for (const processor of this.processors.values()) {
      try {
        processor.disconnect();
      } catch {
        // Ignore errors
      }
    }
    this.processors.clear();

    // Disconnect and clean up all source nodes
    for (const sourceNode of this.sourceNodes.values()) {
      try {
        sourceNode.disconnect();
      } catch {
        // Ignore errors
      }
    }
    this.sourceNodes.clear();

    // Stop and clean up cloned tracks to release resources
    for (const clonedTrack of this.clonedTracks.values()) {
      try {
        clonedTrack.stop();
      } catch {
        // Ignore errors
      }
    }
    this.clonedTracks.clear();

    // Clear track capture map
    this.trackCaptureMap.clear();

    // Close AudioContext to release hardware resources
    if (this.audioContext) {
      const ctx = this.audioContext as unknown as AudioContext;
      if (ctx.state !== 'closed') {
        ctx.close().catch(() => {
          // Ignore errors
        });
      }
      this.audioContext = null;
    }
  }

  cleanup(): void {
    // Clean up audio capture resources
    this.#cleanupAudioCapture();

    // Remove all audio elements
    for (const audioElement of this.audioElements) {
      try {
        if (audioElement?.parentNode?.removeChild) {
          audioElement.parentNode.removeChild(audioElement);
        }
      } catch {
        // Ignore DOM cleanup errors
      }
    }
    this.audioElements.clear();

    // Clear track data
    this.trackStats.clear();
  }

  /**
   * Detects the supported audio MIME type for MediaRecorder
   * @private
   */
  #getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus', // Preferred (Chrome, Firefox)
      'audio/mp4', // Safari
      'audio/aac', // Safari fallback
      'audio/webm', // Generic WebM
      'audio/ogg', // Older Firefox
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return ''; // Let browser choose default
  }

  /**
   * Converts Float32 audio samples (-1.0 to 1.0) to Int16 (-32768 to 32767)
   * @private
   */
  #float32ToInt16(buffer: Float32Array): Int16Array {
    const l = buffer.length;
    const buf = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      // Clamp to -1.0 to 1.0 before scaling
      buf[i] = Math.max(-1, Math.min(1, buffer[i])) * INT16_SCALE;
    }
    return buf;
  }
}
